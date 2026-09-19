import { ERROR_CODES, ROLES } from '../config/constants'
import type { PublicUser, UserListResponse } from './user.service'
import { UserService } from './user.service'
import { UserController } from './user.controller'
import { CreateStaffDto } from './dto/create-staff.dto'
import { UserQueryDto } from './dto/user-query.dto'

const publicUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1',
  email: 'cliente@example.com',
  role: ROLES.customer,
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
  active: true,
  branchId: null,
  vehicle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const emptyList: UserListResponse = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

interface ServiceMock {
  findById: jest.Mock
  list: jest.Mock
  createUser: jest.Mock
  update: jest.Mock
  setActive: jest.Mock
}

const makeController = (overrides: Partial<ServiceMock> = {}) => {
  const service: ServiceMock = {
    findById: jest.fn(),
    list: jest.fn().mockResolvedValue(emptyList),
    createUser: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...overrides,
  }
  return { service, controller: new UserController(service as unknown as UserService) }
}

const staffDto: CreateStaffDto = {
  firstName: 'Sofía',
  lastName: 'Sosa',
  email: 'staff@example.com',
  phone: '11223344',
  password: 'password123',
  branchId: 'branch-1',
}

describe('UserController.list (RQ-AUTH: listado con filtros)', () => {
  it('aplica los defaults de paginación limit 20 / offset 0', async () => {
    const { service, controller } = makeController()

    await controller.list({} as UserQueryDto)

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
    )
  })

  it.each<{ name: string; query: UserQueryDto }>([
    { name: 'filtro por rol', query: { role: ROLES.rider } },
    { name: 'filtro por active false', query: { active: false } },
    { name: 'búsqueda de texto', query: { search: 'juan' } },
  ])('reenvía $name al servicio', async ({ query }) => {
    const { service, controller } = makeController()

    await controller.list(query)

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining(query))
  })

  it('respeta la paginación explícita', async () => {
    const { service, controller } = makeController()

    await controller.list({ limit: 5, offset: 10 })

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 10 }))
  })
})

describe('UserController.createStaff (RQ-AUTH-13)', () => {
  it('crea un branch_admin forzando el rol y conservando branchId', async () => {
    const { service, controller } = makeController({
      createUser: jest.fn().mockResolvedValue(publicUser({ role: ROLES.branchAdmin })),
    })

    const result = await controller.createStaff(staffDto)

    expect(result.role).toBe(ROLES.branchAdmin)
    expect(service.createUser).toHaveBeenCalledWith({
      ...staffDto,
      role: ROLES.branchAdmin,
    })
  })

  it.each([
    { name: 'sucursal existente', branchId: 'branch-1' },
    { name: 'sucursal inexistente', branchId: 'no-existe' },
    { name: 'cadena vacía', branchId: '' },
  ])('acepta cualquier branchId sin validarlo contra Commerce: $name (KNOWN BUG: RQ-AUTH-13)', async ({
    branchId,
  }) => {
    const { service, controller } = makeController({
      createUser: jest.fn().mockResolvedValue(publicUser({ role: ROLES.branchAdmin, branchId })),
    })

    await controller.createStaff({ ...staffDto, branchId })

    // No existe llamada a Commerce/Branch: el servicio recibe el branchId tal cual.
    expect(service.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: ROLES.branchAdmin, branchId }),
    )
    expect(service.findById).not.toHaveBeenCalled()
  })
})

describe('UserController.createAdmin (RQ-AUTH-14)', () => {
  it('crea un super_admin forzando el rol', async () => {
    const { service, controller } = makeController({
      createUser: jest.fn().mockResolvedValue(publicUser({ role: ROLES.superAdmin })),
    })
    const dto = {
      firstName: 'Admin',
      lastName: 'Global',
      email: 'admin@example.com',
      phone: '1',
      password: 'password123',
    }

    const result = await controller.createAdmin(dto)

    expect(result.role).toBe(ROLES.superAdmin)
    expect(service.createUser).toHaveBeenCalledWith({ ...dto, role: ROLES.superAdmin })
  })
})

describe('UserController.createRider (RQ-AUTH-15)', () => {
  it('crea un rider forzando el rol y conservando el vehículo', async () => {
    const { service, controller } = makeController({
      createUser: jest.fn().mockResolvedValue(publicUser({ role: ROLES.rider, vehicle: 'Moto' })),
    })
    const dto = {
      firstName: 'Rider',
      lastName: 'Uno',
      email: 'rider@example.com',
      phone: '1',
      password: 'password123',
      vehicle: 'Moto',
    }

    const result = await controller.createRider(dto)

    expect(result.role).toBe(ROLES.rider)
    expect(result.vehicle).toBe('Moto')
    expect(service.createUser).toHaveBeenCalledWith({ ...dto, role: ROLES.rider })
  })
})

describe('UserController.get (RQ-AUTH-17)', () => {
  it('devuelve el usuario cuando existe', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
    })

    await expect(controller.get('u1')).resolves.toMatchObject({ id: 'u1' })
  })

  it('lanza USER_NOT_FOUND 404 con mensaje cuando no existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.get('missing')).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      message: 'Usuario no encontrado',
      status: 404,
    })
  })
})

describe('UserController.update (RQ-AUTH-16)', () => {
  it('actualiza un usuario editable', async () => {
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
      update: jest.fn().mockResolvedValue(publicUser({ firstName: 'Ana' })),
    })

    const result = await controller.update('u1', { firstName: 'Ana' })

    expect(service.update).toHaveBeenCalledWith('u1', { firstName: 'Ana' })
    expect(result.firstName).toBe('Ana')
  })

  it('lanza USER_NOT_FOUND 404 si el destinatario no existe', async () => {
    const { service, controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.update('missing', { firstName: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      message: 'Usuario no encontrado',
      status: 404,
    })
    expect(service.update).not.toHaveBeenCalled()
  })

  it('lanza FORBIDDEN 403 si el destinatario es super_admin', async () => {
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser({ role: ROLES.superAdmin })),
    })

    await expect(controller.update('admin', { firstName: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.forbidden,
      message: 'Los admins globales no se pueden editar ni desactivar',
      status: 403,
    })
    expect(service.update).not.toHaveBeenCalled()
  })

  it('lanza USER_NOT_FOUND 404 si el servicio no encuentra el usuario al persistir', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
      update: jest.fn().mockResolvedValue(null),
    })

    await expect(controller.update('u1', { firstName: 'X' })).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      status: 404,
    })
  })
})

describe('UserController.setActive (RQ-AUTH-16)', () => {
  it.each([
    { name: 'activar', active: true },
    { name: 'desactivar', active: false },
  ])('$name un usuario editable', async ({ active }) => {
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
      setActive: jest.fn().mockResolvedValue(publicUser({ active })),
    })

    const result = await controller.setActive('u1', { active })

    expect(service.setActive).toHaveBeenCalledWith('u1', active)
    expect(result.active).toBe(active)
  })

  it('lanza USER_NOT_FOUND 404 si el destinatario no existe', async () => {
    const { service, controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.setActive('missing', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      status: 404,
    })
    expect(service.setActive).not.toHaveBeenCalled()
  })

  it('lanza FORBIDDEN 403 al intentar desactivar un super_admin', async () => {
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser({ role: ROLES.superAdmin })),
    })

    await expect(controller.setActive('admin', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.forbidden,
      status: 403,
    })
    expect(service.setActive).not.toHaveBeenCalled()
  })

  it('lanza USER_NOT_FOUND 404 si el servicio no encuentra el usuario al persistir', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
      setActive: jest.fn().mockResolvedValue(null),
    })

    await expect(controller.setActive('u1', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      status: 404,
    })
  })
})
