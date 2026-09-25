import type { AuthContext } from '../config/security/jwt.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { AuthController } from './auth.controller'
import { AuthOrchestrator } from './auth.orchestrator'

const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' }

const authContext = (userId: string | null): AuthContext => ({
  authenticated: userId !== null,
  userId,
  roles: [],
  branchId: null,
})

const makeController = () => {
  const orchestrator = {
    register: jest.fn().mockResolvedValue(tokens),
    registerRider: jest.fn().mockResolvedValue(tokens),
    login: jest.fn().mockResolvedValue(tokens),
    refresh: jest.fn().mockResolvedValue(tokens),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPasswordRecovery: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
  }
  return {
    orchestrator,
    controller: new AuthController(orchestrator as unknown as AuthOrchestrator),
  }
}

describe('AuthController.register (RQ-AUTH-01)', () => {
  it('delega el DTO y devuelve access + refresh token', async () => {
    const { controller, orchestrator } = makeController()
    const dto = {
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'cliente@example.com',
      phone: '11223344',
      password: 'secreto123',
    }

    await expect(controller.register(dto)).resolves.toEqual(tokens)
    expect(orchestrator.register).toHaveBeenCalledWith(dto)
  })

  it('propaga EMAIL_TAKEN 409 del orquestador', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.register.mockRejectedValue(
      new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409),
    )

    await expect(
      controller.register({
        firstName: 'Juan',
        lastName: 'Perez',
        email: 'cliente@example.com',
        phone: '11223344',
        password: 'secreto123',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.emailTaken,
      message: 'El correo ya está registrado',
      status: 409,
    })
  })
})

describe('AuthController.registerRider', () => {
  it('delega el auto-registro de repartidor', async () => {
    const { controller, orchestrator } = makeController()
    const dto = {
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'rider@example.com',
      phone: '11223344',
      password: 'secreto123',
      vehicle: 'Moto',
    }

    await expect(controller.registerRider(dto)).resolves.toEqual(tokens)
    expect(orchestrator.registerRider).toHaveBeenCalledWith(dto)
  })
})

describe('AuthController.login (RQ-AUTH-04/06)', () => {
  it('delega las credenciales y devuelve los tokens', async () => {
    const { controller, orchestrator } = makeController()
    const dto = { email: 'cliente@example.com', password: 'secreto123' }

    await expect(controller.login(dto)).resolves.toEqual(tokens)
    expect(orchestrator.login).toHaveBeenCalledWith(dto)
  })

  it.each([
    {
      name: 'credenciales inválidas',
      error: new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401),
    },
    {
      name: 'usuario inactivo',
      error: new DomainException(ERROR_CODES.userInactive, 'Usuario inactivo', 403),
    },
  ])('propaga $name con su code y status', async ({ error }) => {
    const { controller, orchestrator } = makeController()
    orchestrator.login.mockRejectedValue(error)

    await expect(
      controller.login({ email: 'cliente@example.com', password: 'mala' }),
    ).rejects.toMatchObject({ code: error.code, message: error.message, status: error.getStatus() })
  })
})

describe('AuthController.refresh (RQ-AUTH-07)', () => {
  it('pasa el refreshToken del DTO al orquestador', async () => {
    const { controller, orchestrator } = makeController()

    await expect(controller.refresh({ refreshToken: 'refresh-crudo' })).resolves.toEqual(tokens)
    expect(orchestrator.refresh).toHaveBeenCalledWith('refresh-crudo')
  })

  it('propaga INVALID_REFRESH_TOKEN 401', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.refresh.mockRejectedValue(
      new DomainException(ERROR_CODES.invalidRefreshToken, 'Refresh token inválido', 401),
    )

    await expect(controller.refresh({ refreshToken: 'malo' })).rejects.toMatchObject({
      code: ERROR_CODES.invalidRefreshToken,
      message: 'Refresh token inválido',
      status: 401,
    })
  })
})

describe('AuthController.logout (RQ-AUTH-08)', () => {
  it('revoca la sesión del usuario autenticado y responde neutral', async () => {
    const { controller, orchestrator } = makeController()

    await expect(controller.logout(authContext('u1'))).resolves.toEqual({ ok: true })
    expect(orchestrator.logout).toHaveBeenCalledWith('u1')
  })

  it('sin userId no invoca al orquestador y responde neutral', async () => {
    const { controller, orchestrator } = makeController()

    await expect(controller.logout(authContext(null))).resolves.toEqual({ ok: true })
    expect(orchestrator.logout).not.toHaveBeenCalled()
  })
})

describe('AuthController.requestPasswordRecovery (RQ-AUTH-09)', () => {
  it.each([
    { name: 'correo existente', email: 'cliente@example.com' },
    { name: 'correo inexistente', email: 'nadie@example.com' },
    { name: 'correo con formato válido raro', email: 'a.b+c@sub.dominio.co' },
  ])('responde neutral para $name', async ({ email }) => {
    const { controller, orchestrator } = makeController()

    await expect(controller.requestPasswordRecovery({ email })).resolves.toEqual({ ok: true })
    expect(orchestrator.requestPasswordRecovery).toHaveBeenCalledWith(email)
  })
})

describe('AuthController.resetPassword (RQ-AUTH-10)', () => {
  it('pasa el token y la nueva contraseña al orquestador', async () => {
    const { controller, orchestrator } = makeController()

    await expect(
      controller.resetPassword({ token: 'token-crudo', newPassword: 'nueva-clave-123' }),
    ).resolves.toEqual({ ok: true })
    expect(orchestrator.resetPassword).toHaveBeenCalledWith('token-crudo', 'nueva-clave-123')
  })

  it('propaga INVALID_OR_EXPIRED_TOKEN 400', async () => {
    const { controller, orchestrator } = makeController()
    orchestrator.resetPassword.mockRejectedValue(
      new DomainException(ERROR_CODES.invalidOrExpiredToken, 'Token inválido o expirado', 400),
    )

    await expect(
      controller.resetPassword({ token: 'malo', newPassword: 'nueva-clave-123' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.invalidOrExpiredToken,
      message: 'Token inválido o expirado',
      status: 400,
    })
  })
})
