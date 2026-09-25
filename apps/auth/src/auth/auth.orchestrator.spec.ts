import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { JwtService } from '../config/security/jwt.service'
import { EmailService } from '../email/email.service'
import { PasswordRecoveryService } from '../password-recovery/password-recovery.service'
import { RefreshTokenService } from '../refresh-token/refresh-token.service'
import { PublicUser, UserService } from '../user/user.service'
import { AuthOrchestrator } from './auth.orchestrator'

const publicUser: PublicUser = {
  id: 'u1',
  email: 'cliente@example.com',
  role: 'customer',
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
  active: true,
  branchId: null,
  vehicle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const makeUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  ...publicUser,
  ...overrides,
})

const makeOrchestrator = () => {
  const userService = {
    createUser: jest.fn(),
    verifyCredentials: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    setPassword: jest.fn(),
  }
  const refreshTokenService = {
    issue: jest.fn(),
    rotate: jest.fn(),
    revokeAll: jest.fn(),
  }
  const passwordRecoveryService = {
    create: jest.fn(),
    consume: jest.fn(),
  }
  const jwtService = {
    signAccessToken: jest.fn().mockReturnValue('access-token'),
  }
  const emailService = {
    sendPasswordRecovery: jest.fn(),
  }

  const orchestrator = new AuthOrchestrator(
    userService as unknown as UserService,
    refreshTokenService as unknown as RefreshTokenService,
    passwordRecoveryService as unknown as PasswordRecoveryService,
    jwtService as unknown as JwtService,
    emailService as unknown as EmailService,
  )

  return {
    orchestrator,
    userService,
    refreshTokenService,
    passwordRecoveryService,
    jwtService,
    emailService,
  }
}

const credentials = { email: 'cliente@example.com', password: 'secreto123' }

const invalidCredentialsError = () =>
  new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401)
const invalidRefreshTokenError = () =>
  new DomainException(ERROR_CODES.invalidRefreshToken, 'Refresh token inválido', 401)
const invalidOrExpiredTokenError = () =>
  new DomainException(ERROR_CODES.invalidOrExpiredToken, 'Token inválido o expirado', 400)

describe('AuthOrchestrator.register (RQ-AUTH-01/05)', () => {
  it('registra un cliente y emite access + refresh token', async () => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    userService.createUser.mockResolvedValue(publicUser)
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    const result = await orchestrator.register({
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'cliente@example.com',
      phone: '11223344',
      password: 'secreto123',
    })

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: ROLES.customer, email: 'cliente@example.com' }),
    )
    expect(jwtService.signAccessToken).toHaveBeenCalledWith({
      id: 'u1',
      role: ROLES.customer,
      branchId: null,
    })
    expect(refreshTokenService.issue).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
  })

  it('propaga el error EMAIL_TAKEN 409 del servicio de usuarios', async () => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.createUser.mockRejectedValue(
      new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409),
    )

    await expect(
      orchestrator.register({
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
    expect(refreshTokenService.issue).not.toHaveBeenCalled()
  })
})

describe('AuthOrchestrator.registerRider (auto-registro de repartidor)', () => {
  it('registra un rider con vehicle, rol rider y emite tokens', async () => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.createUser.mockResolvedValue({ ...publicUser, role: ROLES.rider, vehicle: 'Moto' })
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    const result = await orchestrator.registerRider({
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'rider@example.com',
      phone: '11223344',
      password: 'secreto123',
      vehicle: 'Moto',
    })

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: ROLES.rider, vehicle: 'Moto' }),
    )
    expect(result.refreshToken).toBe('refresh-token')
  })

  it.each([
    { name: 'Moto', vehicle: 'Moto' },
    { name: 'Bicicleta', vehicle: 'Bicicleta' },
    { name: 'Auto', vehicle: 'Auto' },
  ])('envía el vehículo $name al servicio de usuarios', async ({ vehicle }) => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.createUser.mockResolvedValue({ ...publicUser, role: ROLES.rider, vehicle })
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    await orchestrator.registerRider({
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'rider@example.com',
      phone: '11223344',
      password: 'secreto123',
      vehicle,
    })

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: ROLES.rider, vehicle }),
    )
  })
})

describe('AuthOrchestrator.login (RQ-AUTH-04/05/06)', () => {
  it('loguea y emite tokens, registrando el refresh del usuario (hash persistido por el servicio)', async () => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    userService.verifyCredentials.mockResolvedValue(publicUser)
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    const result = await orchestrator.login(credentials)

    expect(userService.verifyCredentials).toHaveBeenCalledWith(
      credentials.email,
      credentials.password,
    )
    expect(jwtService.signAccessToken).toHaveBeenCalledWith({
      id: 'u1',
      role: ROLES.customer,
      branchId: null,
    })
    expect(refreshTokenService.issue).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
  })

  it('propaga branchId al access token de un admin de sucursal', async () => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    userService.verifyCredentials.mockResolvedValue(
      makeUser({ role: ROLES.branchAdmin, branchId: 'branch-1' }),
    )
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    await orchestrator.login(credentials)

    expect(jwtService.signAccessToken).toHaveBeenCalledWith({
      id: 'u1',
      role: ROLES.branchAdmin,
      branchId: 'branch-1',
    })
  })

  it.each([
    { name: 'correo inexistente', error: invalidCredentialsError() },
    { name: 'contraseña incorrecta', error: invalidCredentialsError() },
  ])('rechaza $name con error genérico (RQ-AUTH-06)', async ({ error }) => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.verifyCredentials.mockRejectedValue(error)

    await expect(orchestrator.login(credentials)).rejects.toMatchObject({
      code: ERROR_CODES.invalidCredentials,
      message: 'Credenciales inválidas',
      status: 401,
    })
    expect(refreshTokenService.issue).not.toHaveBeenCalled()
  })

  it('rechaza un usuario inactivo con USER_INACTIVE 403', async () => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.verifyCredentials.mockRejectedValue(
      new DomainException(ERROR_CODES.userInactive, 'Usuario inactivo', 403),
    )

    await expect(orchestrator.login(credentials)).rejects.toMatchObject({
      code: ERROR_CODES.userInactive,
      message: 'Usuario inactivo',
      status: 403,
    })
    expect(refreshTokenService.issue).not.toHaveBeenCalled()
  })
})

describe('AuthOrchestrator.refresh (RQ-AUTH-07/08)', () => {
  it('rota un refresh token válido: invalida el anterior y emite un par nuevo', async () => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    refreshTokenService.rotate.mockResolvedValue({ userId: 'u1', refreshToken: 'nuevo-refresh' })
    userService.findById.mockResolvedValue(publicUser)

    const result = await orchestrator.refresh('refresh-viejo')

    expect(refreshTokenService.rotate).toHaveBeenCalledWith('refresh-viejo')
    expect(jwtService.signAccessToken).toHaveBeenCalledWith({
      id: 'u1',
      role: ROLES.customer,
      branchId: null,
    })
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'nuevo-refresh' })
  })

  it.each([
    { name: 'token inválido' },
    { name: 'token expirado' },
    { name: 'token reutilizado (ya rotado)' },
  ])('rechaza $name con INVALID_REFRESH_TOKEN 401', async () => {
    const { orchestrator, refreshTokenService, jwtService } = makeOrchestrator()
    refreshTokenService.rotate.mockRejectedValue(invalidRefreshTokenError())

    await expect(orchestrator.refresh('refresh-crudo')).rejects.toMatchObject({
      code: ERROR_CODES.invalidRefreshToken,
      message: 'Refresh token inválido',
      status: 401,
    })
    expect(jwtService.signAccessToken).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'usuario inexistente', user: null },
    { name: 'usuario inactivo', user: makeUser({ active: false }) },
  ])('rechaza si el $name aunque el token rote', async ({ user }) => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    refreshTokenService.rotate.mockResolvedValue({ userId: 'u1', refreshToken: 'nuevo-refresh' })
    userService.findById.mockResolvedValue(user)

    await expect(orchestrator.refresh('refresh-viejo')).rejects.toMatchObject({
      code: ERROR_CODES.invalidRefreshToken,
      message: 'Refresh token inválido',
      status: 401,
    })
    expect(jwtService.signAccessToken).not.toHaveBeenCalled()
  })
})

describe('AuthOrchestrator.logout (RQ-AUTH-08)', () => {
  it('revoca todas las sesiones del usuario', async () => {
    const { orchestrator, refreshTokenService } = makeOrchestrator()

    await orchestrator.logout('u1')

    expect(refreshTokenService.revokeAll).toHaveBeenCalledWith('u1')
  })

  it('es idempotente: revocar dos veces no falla ni cambia el usuario', async () => {
    const { orchestrator, refreshTokenService } = makeOrchestrator()
    refreshTokenService.revokeAll.mockResolvedValue(undefined)

    await orchestrator.logout('u1')
    await orchestrator.logout('u1')

    expect(refreshTokenService.revokeAll).toHaveBeenCalledTimes(2)
    expect(refreshTokenService.revokeAll).toHaveBeenNthCalledWith(1, 'u1')
    expect(refreshTokenService.revokeAll).toHaveBeenNthCalledWith(2, 'u1')
  })

  it('no falla al cerrar sesión de un usuario sin tokens activos', async () => {
    const { orchestrator, refreshTokenService } = makeOrchestrator()
    refreshTokenService.revokeAll.mockResolvedValue(undefined)

    await expect(orchestrator.logout('u-sin-tokens')).resolves.toBeUndefined()
    expect(refreshTokenService.revokeAll).toHaveBeenCalledWith('u-sin-tokens')
  })
})

describe('AuthOrchestrator.requestPasswordRecovery (RQ-AUTH-09)', () => {
  it.each([
    { name: 'correo existente', user: publicUser, expectedCalls: 1 },
    { name: 'correo inexistente', user: null, expectedCalls: 0 },
    { name: 'correo existente inactivo', user: makeUser({ active: false }), expectedCalls: 1 },
  ])('responde de forma neutral para $name', async ({ user, expectedCalls }) => {
    const { orchestrator, userService, passwordRecoveryService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(user)

    await expect(
      orchestrator.requestPasswordRecovery('cliente@example.com'),
    ).resolves.toBeUndefined()

    expect(passwordRecoveryService.create).toHaveBeenCalledTimes(expectedCalls)
  })

  it('crea el token de recuperación solo para el usuario encontrado', async () => {
    const { orchestrator, userService, passwordRecoveryService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(publicUser)

    await orchestrator.requestPasswordRecovery('cliente@example.com')

    expect(userService.findByEmail).toHaveBeenCalledWith('cliente@example.com')
    expect(passwordRecoveryService.create).toHaveBeenCalledWith('u1')
  })

  it('envía el correo con el token crudo cuando se generó uno nuevo', async () => {
    const { orchestrator, userService, passwordRecoveryService, emailService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(publicUser)
    passwordRecoveryService.create.mockResolvedValue('token-crudo')

    await orchestrator.requestPasswordRecovery('cliente@example.com')

    expect(emailService.sendPasswordRecovery).toHaveBeenCalledWith({
      to: publicUser.email,
      firstName: publicUser.firstName,
      token: 'token-crudo',
      role: publicUser.role,
    })
  })

  it('no envía correo cuando el servicio aplica el intervalo mínimo (token null)', async () => {
    const { orchestrator, userService, passwordRecoveryService, emailService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(publicUser)
    passwordRecoveryService.create.mockResolvedValue(null)

    await expect(
      orchestrator.requestPasswordRecovery('cliente@example.com'),
    ).resolves.toBeUndefined()

    expect(emailService.sendPasswordRecovery).not.toHaveBeenCalled()
  })

  it('no envía correo si el correo no está registrado', async () => {
    const { orchestrator, userService, emailService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(null)

    await orchestrator.requestPasswordRecovery('nadie@example.com')

    expect(emailService.sendPasswordRecovery).not.toHaveBeenCalled()
  })

  it('absorbe el error del proveedor de correo y responde neutral', async () => {
    const { orchestrator, userService, passwordRecoveryService, emailService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(publicUser)
    passwordRecoveryService.create.mockResolvedValue('token-crudo')
    emailService.sendPasswordRecovery.mockRejectedValue(new Error('proveedor caído'))

    await expect(
      orchestrator.requestPasswordRecovery('cliente@example.com'),
    ).resolves.toBeUndefined()
  })
})

describe('AuthOrchestrator.resetPassword (RQ-AUTH-10, RQ-SEC-08)', () => {
  it('consume el token (marca usado), actualiza el hash y revoca las sesiones', async () => {
    const { orchestrator, userService, passwordRecoveryService, refreshTokenService } =
      makeOrchestrator()
    passwordRecoveryService.consume.mockResolvedValue('u1')

    await orchestrator.resetPassword('token-crudo', 'nueva-clave-123')

    expect(passwordRecoveryService.consume).toHaveBeenCalledWith('token-crudo')
    expect(userService.setPassword).toHaveBeenCalledWith('u1', 'nueva-clave-123')
    expect(refreshTokenService.revokeAll).toHaveBeenCalledWith('u1')
  })

  it('ejecuta el orden consume → setPassword → revokeAll', async () => {
    const { orchestrator, userService, passwordRecoveryService, refreshTokenService } =
      makeOrchestrator()
    passwordRecoveryService.consume.mockResolvedValue('u1')

    await orchestrator.resetPassword('token-crudo', 'nueva-clave-123')

    const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0]
    expect(order(passwordRecoveryService.consume)).toBeLessThan(order(userService.setPassword))
    expect(order(userService.setPassword)).toBeLessThan(order(refreshTokenService.revokeAll))
  })

  it.each([{ name: 'token inexistente' }, { name: 'token expirado' }, { name: 'token ya usado' }])(
    'rechaza $name con INVALID_OR_EXPIRED_TOKEN 400 sin cambiar la contraseña',
    async () => {
      const { orchestrator, userService, passwordRecoveryService, refreshTokenService } =
        makeOrchestrator()
      passwordRecoveryService.consume.mockRejectedValue(invalidOrExpiredTokenError())

      await expect(
        orchestrator.resetPassword('token-crudo', 'nueva-clave-123'),
      ).rejects.toMatchObject({
        code: ERROR_CODES.invalidOrExpiredToken,
        message: 'Token inválido o expirado',
        status: 400,
      })
      expect(userService.setPassword).not.toHaveBeenCalled()
      expect(refreshTokenService.revokeAll).not.toHaveBeenCalled()
    },
  )
})
