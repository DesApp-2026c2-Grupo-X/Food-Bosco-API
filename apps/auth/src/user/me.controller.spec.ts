import { ERROR_CODES, ROLES } from '../config/constants'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicUser } from './user.service'
import { UserService } from './user.service'
import { MeController } from './me.controller'

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'u1',
  roles: [ROLES.customer],
  branchId: null,
  ...overrides,
})

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

interface ServiceMock {
  findById: jest.Mock
  update: jest.Mock
}

const makeController = (overrides: Partial<ServiceMock> = {}) => {
  const service: ServiceMock = {
    findById: jest.fn(),
    update: jest.fn(),
    ...overrides,
  }
  return { service, controller: new MeController(service as unknown as UserService) }
}

describe('MeController.me (RQ-AUTH-11/18)', () => {
  it('devuelve el perfil del usuario autenticado con su rol', async () => {
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(publicUser()),
    })

    const result = await controller.me(auth())

    expect(service.findById).toHaveBeenCalledWith('u1')
    expect(result.id).toBe('u1')
    expect(result.role).toBe(ROLES.customer)
  })

  it('lanza USER_NOT_FOUND 404 cuando el usuario autenticado no existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.me(auth())).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      message: 'Usuario no encontrado',
      status: 404,
    })
  })

  it('lanza USER_NOT_FOUND 404 cuando no hay userId en el contexto', async () => {
    const { service, controller } = makeController()

    await expect(controller.me(auth({ userId: null }))).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      status: 404,
    })
    expect(service.findById).not.toHaveBeenCalled()
  })
})

describe('MeController.updateMe (RQ-AUTH-11)', () => {
  it('modifica el propio perfil con los campos permitidos', async () => {
    const { service, controller } = makeController({
      update: jest.fn().mockResolvedValue(publicUser({ firstName: 'Pedro' })),
    })
    const dto = { firstName: 'Pedro', lastName: 'Gomez', phone: '999' }

    const result = await controller.updateMe(auth(), dto)

    expect(service.update).toHaveBeenCalledWith('u1', dto)
    expect(result.firstName).toBe('Pedro')
  })

  it('lanza USER_NOT_FOUND 404 si el usuario no existe al actualizar', async () => {
    const { controller } = makeController({ update: jest.fn().mockResolvedValue(null) })

    await expect(
      controller.updateMe(auth(), { firstName: 'X', lastName: 'Y', phone: '1' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.userNotFound,
      message: 'Usuario no encontrado',
      status: 404,
    })
  })

  it('lanza USER_NOT_FOUND 404 cuando no hay userId en el contexto', async () => {
    const { service, controller } = makeController()

    await expect(
      controller.updateMe(auth({ userId: null }), { firstName: 'X', lastName: 'Y', phone: '1' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.userNotFound, status: 404 })
    expect(service.update).not.toHaveBeenCalled()
  })
})
