import { hash } from 'bcryptjs'
import { ERROR_CODES } from '../config/constants'
import { User, UserDocument } from './user.model'
import { UserRepository } from './user.repository'
import { UserService } from './user.service'

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

const input = {
  email: 'cliente@example.com',
  password: 'secreto123',
  role: 'customer' as const,
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
}

describe('UserService.createUser (RQ-AUTH-01/02/03)', () => {
  const repository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  }
  const service = new UserService(repository as unknown as UserRepository)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('crea el usuario con la contraseña hasheada (nunca en texto plano)', async () => {
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockImplementation(async (data: { passwordHash: string }) =>
      buildDoc({ passwordHash: data.passwordHash }),
    )

    await service.createUser(input)

    const created = repository.create.mock.calls[0][0] as { passwordHash: string }
    expect(created.passwordHash).not.toBe('secreto123')
    expect(created.passwordHash.startsWith('$2')).toBe(true)
  })

  it('devuelve el perfil público sin exponer el hash', async () => {
    repository.findByEmail.mockResolvedValue(null)
    repository.create.mockImplementation(async (data: { passwordHash: string }) =>
      buildDoc({ passwordHash: data.passwordHash }),
    )

    const result = await service.createUser(input)

    expect(result.id).toBe('u1')
    expect(result.role).toBe('customer')
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined()
  })

  it('rechaza un correo ya registrado (RQ-AUTH-02)', async () => {
    repository.findByEmail.mockResolvedValue(buildDoc())

    await expect(service.createUser(input)).rejects.toMatchObject({
      code: ERROR_CODES.emailTaken,
    })
    expect(repository.create).not.toHaveBeenCalled()
  })
})

describe('UserService.verifyCredentials (RQ-AUTH-04/06)', () => {
  const repository = {
    findByEmailWithPassword: jest.fn(),
  }
  const service = new UserService(repository as unknown as UserRepository)
  let passwordHash = ''

  beforeAll(async () => {
    passwordHash = await hash('secreto123', 10)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('devuelve el usuario con credenciales válidas', async () => {
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash }))

    const result = await service.verifyCredentials('cliente@example.com', 'secreto123')

    expect(result.id).toBe('u1')
    expect(result.role).toBe('customer')
  })

  it('rechaza con error genérico si el correo no existe', async () => {
    repository.findByEmailWithPassword.mockResolvedValue(null)

    await expect(
      service.verifyCredentials('nadie@example.com', 'secreto123'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.invalidCredentials,
    })
  })

  it('rechaza con error genérico si la contraseña es incorrecta', async () => {
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash }))

    await expect(
      service.verifyCredentials('cliente@example.com', 'otra-clave'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.invalidCredentials,
    })
  })

  it('rechaza un usuario inactivo', async () => {
    repository.findByEmailWithPassword.mockResolvedValue(buildDoc({ passwordHash, active: false }))

    await expect(
      service.verifyCredentials('cliente@example.com', 'secreto123'),
    ).rejects.toMatchObject({
      code: ERROR_CODES.userInactive,
    })
  })
})

describe('UserService.setPassword (RQ-SEC-08)', () => {
  it('hashea la nueva contraseña antes de persistirla', async () => {
    const repository = {
      updatePassword: jest.fn().mockResolvedValue(undefined),
    }
    const service = new UserService(repository as unknown as UserRepository)

    await service.setPassword('u1', 'nueva-clave-123')

    const stored = repository.updatePassword.mock.calls[0][1]
    expect(stored).not.toBe('nueva-clave-123')
    expect(stored.startsWith('$2')).toBe(true)
  })
})

describe('UserService.list', () => {
  it('devuelve datos serializados y meta de paginación', async () => {
    const repository = {
      list: jest.fn().mockResolvedValue({ data: [buildDoc()], total: 1 }),
    }
    const service = new UserService(repository as unknown as UserRepository)

    const result = await service.list({ limit: 20, offset: 0 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('u1')
    expect(result.meta).toEqual({ total: 1, limit: 20, offset: 0 })
  })
})

describe('UserService.update / setActive / findById', () => {
  it('update devuelve null si el usuario no existe', async () => {
    const repository = { update: jest.fn().mockResolvedValue(null) }
    const service = new UserService(repository as unknown as UserRepository)

    await expect(service.update('missing', { firstName: 'X' })).resolves.toBeNull()
  })

  it('setActive actualiza y serializa', async () => {
    const repository = { setActive: jest.fn().mockResolvedValue(buildDoc({ active: false })) }
    const service = new UserService(repository as unknown as UserRepository)

    const result = await service.setActive('u1', false)

    expect(result?.active).toBe(false)
    expect(repository.setActive).toHaveBeenCalledWith('u1', false)
  })

  it('findById devuelve null si no existe', async () => {
    const repository = { findById: jest.fn().mockResolvedValue(null) }
    const service = new UserService(repository as unknown as UserRepository)

    await expect(service.findById('missing')).resolves.toBeNull()
  })
})
