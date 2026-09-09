import { ERROR_CODES } from '../config/constants'
import { sha256 } from '../config/crypto'
import { RefreshTokenRepository } from './refresh-token.repository'
import { RefreshTokenService } from './refresh-token.service'

const buildDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date(Date.now() + 60_000),
    revoked: false,
    ...overrides,
  }) as never

describe('RefreshTokenService.issue', () => {
  it('persiste el hash y devuelve el token crudo', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    const raw = await service.issue('u1')

    const data = repository.create.mock.calls[0][0]
    expect(data.userId).toBe('u1')
    expect(data.tokenHash).toBe(sha256(raw))
    expect(data.tokenHash).not.toBe(raw)
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('RefreshTokenService.rotate (RQ-AUTH-07/08)', () => {
  const makeService = (doc: ReturnType<typeof buildDoc> | null) => {
    const repository = {
      findByTokenHash: jest.fn().mockResolvedValue(doc),
      markRevokedByHash: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(buildDoc()),
    }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)
    return { repository, service }
  }

  it('rota un token válido: revoca el anterior y emite uno nuevo', async () => {
    const { repository, service } = makeService(buildDoc())

    const result = await service.rotate('raw-token')

    expect(result.userId).toBe('u1')
    expect(repository.markRevokedByHash).toHaveBeenCalledWith(sha256('raw-token'))
    expect(repository.create).toHaveBeenCalledTimes(1)
    expect(result.refreshToken).toBeTruthy()
  })

  it.each([
    { name: 'token inexistente', doc: null },
    { name: 'token revocado', doc: buildDoc({ revoked: true }) },
    { name: 'token expirado', doc: buildDoc({ expiresAt: new Date(Date.now() - 1_000) }) },
  ])('rechaza $name', async ({ doc }) => {
    const { service } = makeService(doc)

    await expect(service.rotate('raw-token')).rejects.toMatchObject({
      code: ERROR_CODES.invalidRefreshToken,
    })
  })
})

describe('RefreshTokenService.revokeAll (RQ-AUTH-08)', () => {
  it('revoca todas las sesiones del usuario', async () => {
    const repository = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await service.revokeAll('u1')

    expect(repository.revokeAllForUser).toHaveBeenCalledWith('u1')
  })
})
