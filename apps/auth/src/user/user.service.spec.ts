import { hash } from 'bcryptjs'
import { ERROR_CODES, ROLES } from '../config/constants'
import type { Role } from '../config/constants'
import { User, UserDocument } from './user.model'
import { UserRepository } from './user.repository'
import { CreateUserInput, UserService } from './user.service'

const buildDoc = (overrides: Partial<User> = {}): UserDocument =>
  ({
    _id: { toString: () => 'u1' },
    email: 'cliente@example.com',
    passwordHash: 'irrelevante',
    role: 'customer',
    firstName: 'Juan',
    lastName: 'Perez',
    phone: '11223344',
    active: true,
    branchId: null,
    vehicle: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as UserDocument

const baseInput: CreateUserInput = {
  email: 'cliente@example.com',
  password: 'secreto123',
  role: ROLES.customer,
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
}

interface RepositoryMock {
  findByEmail: jest.Mock
  findByEmailWithPassword: jest.Mock
  findById: jest.Mock
  create: jest.Mock
  list: jest.Mock
  update: jest.Mock
  setActive: jest.Mock
  updatePassword: jest.Mock
}

const makeService = (overrides: Partial<RepositoryMock> = {}) => {
  const repository: RepositoryMock = {
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    updatePassword: jest.fn(),
    ...overrides,
  }
  return { repository, service: new UserService(repository as unknown as UserRepository) }
}

describe('UserService.createUser (RQ-AUTH-01/02/03)', () => {
  it('hashea la contraseña antes de persistirla (nunca en texto plano)', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockImplementation(async (data: { passwordHash: string }) =>
      buildDoc({ passwordHash: data.passwordHash }),
    )

    await service.createUser(baseInput)

    const created = repository.create.mock.calls[0][0] as {
      passwordHash: string
      password?: string
    }
    expect(created.passwordHash).not.toBe(baseInput.password)
    expect(created.passwordHash.startsWith('$2')).toBe(true)
    expect(created.password).toBeUndefined()
  })

  it('verifica la unicidad del correo antes de crear (RQ-AUTH-02)', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockResolvedValue(buildDoc())

    await service.createUser(baseInput)

    expect(repository.findByEmail).toHaveBeenCalledWith(baseInput.email)
  })

  it('rechaza un correo ya registrado con EMAIL_TAKEN 409 (RQ-AUTH-02)', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(buildDoc())

    await expect(service.createUser(baseInput)).rejects.toMatchObject({
      code: ERROR_CODES.emailTaken,
      message: 'El correo ya está registrado',
      status: 409,
    })
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('devuelve el perfil público sin exponer el hash', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockImplementation(async (data: { passwordHash: string }) =>
      buildDoc({ passwordHash: data.passwordHash }),
    )

    const result = await service.createUser(baseInput)

    expect(result.id).toBe('u1')
    expect(result.role).toBe(ROLES.customer)
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined()
    expect(Object.keys(result)).not.toContain('passwordHash')
  })

  it.each<{ name: string; role: Role; branchId?: string; vehicle?: string }>([
    { name: 'cliente', role: ROLES.customer },
    { name: 'colaborador de sucursal con branchId', role: ROLES.branchAdmin, branchId: 'branch-1' },
    { name: 'admin global', role: ROLES.superAdmin },
    { name: 'repartidor con vehículo', role: ROLES.rider, vehicle: 'Moto' },
  ])('crea un $name con el rol y datos específicos', async ({ role, branchId, vehicle }) => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockImplementation(async (data: { passwordHash: string }) =>
      buildDoc({ role, branchId: branchId ?? null, vehicle: vehicle ?? null, ...data }),
    )
    const extraFields = {
      ...(branchId !== undefined ? { branchId } : {}),
      ...(vehicle !== undefined ? { vehicle } : {}),
    }

    const result = await service.createUser({ ...baseInput, role, ...extraFields })

    expect(result.role).toBe(role)
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role, ...extraFields }),
    )
  })
})

describe('UserService.verifyCredentials (RQ-AUTH-04/06)', () => {
  let passwordHash = ''

  beforeAll(async () => {
    passwordHash = await hash('secreto123', 10)
  })

  it('devuelve el usuario con credenciales válidas', async () => {
    const { repository, service } = makeService()
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash }))

    const result = await service.verifyCredentials('cliente@example.com', 'secreto123')

    expect(result.id).toBe('u1')
    expect(result.role).toBe(ROLES.customer)
    expect(repository.findByEmailWithPassword).toHaveBeenCalledWith('cliente@example.com')
  })

  it('rechaza con error genérico si el correo no existe (RQ-AUTH-06)', async () => {
    const { repository, service } = makeService()
    repository.findByEmailWithPassword.mockResolvedValue(null)

    await expect(
      service.verifyCredentials('nadie@example.com', 'secreto123'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.invalidCredentials,
      message: 'Credenciales inválidas',
      status: 401,
    })
  })

  it('rechaza con error genérico si la contraseña es incorrecta (RQ-AUTH-06)', async () => {
    const { repository, service } = makeService()
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash }))

    await expect(
      service.verifyCredentials('cliente@example.com', 'otra-clave'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.invalidCredentials,
      message: 'Credenciales inválidas',
      status: 401,
    })
  })

  it('rechaza un usuario inactivo con USER_INACTIVE 403', async () => {
    const { repository, service } = makeService()
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash, active: false }))

    await expect(
      service.verifyCredentials('cliente@example.com', 'secreto123'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.userInactive,
      message: 'Usuario inactivo',
      status: 403,
    })
  })

  it('un usuario inactivo con contraseña incorrecta recibe INVALID_CREDENTIALS (verifica la clave antes del estado)', async () => {
    const { repository, service } = makeService()
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash, active: false }))

    await expect(
      service.verifyCredentials('cliente@example.com', 'otra-clave'),
    ).rejects.toMatchObject({ code: ERROR_CODES.invalidCredentials, status: 401 })
  })
})

describe('UserService.findByEmail / findById (RQ-AUTH-17)', () => {
  it('findByEmail devuelve el perfil serializado cuando existe', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(buildDoc())

    const result = await service.findByEmail('cliente@example.com')

    expect(result?.id).toBe('u1')
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined()
  })

  it('findByEmail devuelve null cuando no existe', async () => {
    const { repository, service } = makeService()
    repository.findByEmail.mockResolvedValue(null)

    await expect(service.findByEmail('nadie@example.com')).resolves.toBeNull()
  })

  it('findById devuelve el perfil serializado cuando existe', async () => {
    const { repository, service } = makeService()
    repository.findById.mockResolvedValue(buildDoc())

    const result = await service.findById('u1')

    expect(repository.findById).toHaveBeenCalledWith('u1')
    expect(result?.id).toBe('u1')
  })

  it('findById devuelve null cuando no existe', async () => {
    const { repository, service } = makeService()
    repository.findById.mockResolvedValue(null)

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})

describe('UserService.list (RQ-AUTH: listado con filtros)', () => {
  it.each<{ name: string; query: Parameters<UserService['list']>[0] }>([
    { name: 'solo paginación', query: { limit: 20, offset: 0 } },
    { name: 'filtro por rol', query: { role: ROLES.rider, limit: 20, offset: 0 } },
    { name: 'filtro por active', query: { active: false, limit: 20, offset: 0 } },
    { name: 'filtro por búsqueda', query: { search: 'juan', limit: 5, offset: 10 } },
    {
      name: 'todos los filtros combinados',
      query: { role: ROLES.branchAdmin, active: true, search: 'suc', limit: 50, offset: 100 },
    },
  ])('reenvía la consulta al repositorio: $name', async ({ query }) => {
    const { repository, service } = makeService()
    repository.list.mockResolvedValue({ data: [buildDoc()], total: 1 })

    const result = await service.list(query)

    expect(repository.list).toHaveBeenCalledWith(query)
    expect(result.meta).toEqual({ total: 1, limit: query.limit, offset: query.offset })
  })

  it('serializa cada documento y respeta el total del repositorio', async () => {
    const { repository, service } = makeService()
    repository.list.mockResolvedValue({
      data: [buildDoc(), buildDoc({ _id: { toString: () => 'u2' } } as Partial<User>)],
      total: 2,
    })

    const result = await service.list({ limit: 20, offset: 0 })

    expect(result.data.map((user) => user.id)).toEqual(['u1', 'u2'])
    expect(result.meta.total).toBe(2)
  })

  it('devuelve una lista vacía con meta consistente', async () => {
    const { repository, service } = makeService()
    repository.list.mockResolvedValue({ data: [], total: 0 })

    await expect(service.list({ limit: 20, offset: 0 })).resolves.toEqual({
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    })
  })
})

describe('UserService.update / setActive / findById (RQ-AUTH-16)', () => {
  it.each<{ name: string; patch: Parameters<UserService['update']>[1] }>([
    { name: 'firstName', patch: { firstName: 'Ana' } },
    { name: 'lastName', patch: { lastName: 'Gomez' } },
    { name: 'phone', patch: { phone: '999' } },
    { name: 'branchId', patch: { branchId: 'branch-2' } },
  ])('actualiza el campo permitido $name', async ({ patch }) => {
    const { repository, service } = makeService()
    repository.update.mockResolvedValue(buildDoc(patch))

    const result = await service.update('u1', patch)

    expect(repository.update).toHaveBeenCalledWith('u1', patch)
    expect(result).toMatchObject(patch)
  })

  it('update devuelve null si el usuario no existe', async () => {
    const { repository, service } = makeService()
    repository.update.mockResolvedValue(null)

    await expect(service.update('missing', { firstName: 'X' })).resolves.toBeNull()
  })

  it.each([
    { name: 'activar', active: true },
    { name: 'desactivar', active: false },
  ])('setActive $name y serializa la respuesta', async ({ active }) => {
    const { repository, service } = makeService()
    repository.setActive.mockResolvedValue(buildDoc({ active }))

    const result = await service.setActive('u1', active)

    expect(repository.setActive).toHaveBeenCalledWith('u1', active)
    expect(result?.active).toBe(active)
  })

  it('setActive devuelve null si el usuario no existe', async () => {
    const { repository, service } = makeService()
    repository.setActive.mockResolvedValue(null)

    await expect(service.setActive('missing', false)).resolves.toBeNull()
  })
})

describe('UserService.setPassword (RQ-SEC-08)', () => {
  it('hashea la nueva contraseña antes de persistirla', async () => {
    const { repository, service } = makeService()
    repository.updatePassword.mockResolvedValue(undefined)

    await service.setPassword('u1', 'nueva-clave-123')

    const [id, stored] = repository.updatePassword.mock.calls[0] as [string, string]
    expect(id).toBe('u1')
    expect(stored).not.toBe('nueva-clave-123')
    expect(stored.startsWith('$2')).toBe(true)
  })

  it('nunca persiste la contraseña en texto plano', async () => {
    const { repository, service } = makeService()
    repository.updatePassword.mockResolvedValue(undefined)

    await service.setPassword('u1', 'otra-clave-456')

    expect(repository.updatePassword).not.toHaveBeenCalledWith('u1', 'otra-clave-456')
  })
})
