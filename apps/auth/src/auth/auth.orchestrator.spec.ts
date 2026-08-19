import { DomainException } from '../config/exceptions/domain.exception'
import { ERROR_CODES } from '../config/constants'
import { JwtService } from '../config/security/jwt.service'
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

  const orchestrator = new AuthOrchestrator(
    userService as unknown as UserService,
    refreshTokenService as unknown as RefreshTokenService,
    passwordRecoveryService as unknown as PasswordRecoveryService,
    jwtService as unknown as JwtService,
  )

  return { orchestrator, userService, refreshTokenService, passwordRecoveryService, jwtService }
}

describe('AuthOrchestrator.register (RQ-AUTH-01)', () => {
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
      expect.objectContaining({ role: 'customer', email: 'cliente@example.com' }),
    )
    expect(jwtService.signAccessToken).toHaveBeenCalledWith({ id: 'u1', role: 'customer', branchId: null })
    expect(refreshTokenService.issue).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' })
  })
})

describe('AuthOrchestrator.registerRider (auto-registro de repartidor)', () => {
  it('registra un rider con vehicle y emite tokens', async () => {
    const { orchestrator, userService } = makeOrchestrator()
    userService.createUser.mockResolvedValue({ ...publicUser, role: 'rider', vehicle: 'Moto' })

    await orchestrator.registerRider({
      firstName: 'Juan',
      lastName: 'Perez',
      email: 'rider@example.com',
      phone: '11223344',
      password: 'secreto123',
      vehicle: 'Moto',
    })

    expect(userService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'rider', vehicle: 'Moto' }),
    )
  })
})

describe('AuthOrchestrator.login (RQ-AUTH-04/05)', () => {
  it('loguea y emite tokens', async () => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    userService.verifyCredentials.mockResolvedValue(publicUser)
    refreshTokenService.issue.mockResolvedValue('refresh-token')

    const result = await orchestrator.login({ email: 'cliente@example.com', password: 'secreto123' })

    expect(userService.verifyCredentials).toHaveBeenCalledWith('cliente@example.com', 'secreto123')
    expect(result.accessToken).toBe('access-token')
    expect(result.refreshToken).toBe('refresh-token')
  })

  it('propaga el error de credenciales inválidas', async () => {
    const { orchestrator, userService } = makeOrchestrator()
    userService.verifyCredentials.mockRejectedValue(
      new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401),
    )

    await expect(
      orchestrator.login({ email: 'cliente@example.com', password: 'mala' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.invalidCredentials })
  })
})

describe('AuthOrchestrator.refresh (RQ-AUTH-07)', () => {
  it('renueva con un refresh token válido y usuario activo', async () => {
    const { orchestrator, userService, refreshTokenService, jwtService } = makeOrchestrator()
    refreshTokenService.rotate.mockResolvedValue({ userId: 'u1', refreshToken: 'nuevo-refresh' })
    userService.findById.mockResolvedValue(publicUser)

    const result = await orchestrator.refresh('refresh-viejo')

    expect(refreshTokenService.rotate).toHaveBeenCalledWith('refresh-viejo')
    expect(jwtService.signAccessToken).toHaveBeenCalledWith({ id: 'u1', role: 'customer', branchId: null })
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'nuevo-refresh' })
  })

  it.each([
    { name: 'usuario inexistente', user: null },
    { name: 'usuario inactivo', user: { ...publicUser, active: false } },
  ])('rechaza si el $name', async ({ user }) => {
    const { orchestrator, userService, refreshTokenService } = makeOrchestrator()
    refreshTokenService.rotate.mockResolvedValue({ userId: 'u1', refreshToken: 'nuevo-refresh' })
    userService.findById.mockResolvedValue(user)

    await expect(orchestrator.refresh('refresh-viejo')).rejects.toMatchObject({
      code: ERROR_CODES.invalidRefreshToken,
    })
  })
})

describe('AuthOrchestrator.logout (RQ-AUTH-08)', () => {
  it('revoca todas las sesiones del usuario', async () => {
    const { orchestrator, refreshTokenService } = makeOrchestrator()

    await orchestrator.logout('u1')

    expect(refreshTokenService.revokeAll).toHaveBeenCalledWith('u1')
  })
})

describe('AuthOrchestrator.requestPasswordRecovery (RQ-AUTH-09)', () => {
  it('crea el token si el correo existe', async () => {
    const { orchestrator, userService, passwordRecoveryService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(publicUser)

    await orchestrator.requestPasswordRecovery('cliente@example.com')

    expect(passwordRecoveryService.create).toHaveBeenCalledWith('u1')
  })

  it('responde neutral si el correo no existe (no crea token)', async () => {
    const { orchestrator, userService, passwordRecoveryService } = makeOrchestrator()
    userService.findByEmail.mockResolvedValue(null)

    await orchestrator.requestPasswordRecovery('nadie@example.com')

    expect(passwordRecoveryService.create).not.toHaveBeenCalled()
  })
})

describe('AuthOrchestrator.resetPassword (RQ-AUTH-10, RQ-SEC-08)', () => {
  it('restablece la contraseña y revoca las sesiones', async () => {
    const { orchestrator, userService, passwordRecoveryService, refreshTokenService } = makeOrchestrator()
    passwordRecoveryService.consume.mockResolvedValue('u1')

    await orchestrator.resetPassword('token', 'nueva-clave-123')

    expect(passwordRecoveryService.consume).toHaveBeenCalledWith('token')
    expect(userService.setPassword).toHaveBeenCalledWith('u1', 'nueva-clave-123')
    expect(refreshTokenService.revokeAll).toHaveBeenCalledWith('u1')
  })
})
