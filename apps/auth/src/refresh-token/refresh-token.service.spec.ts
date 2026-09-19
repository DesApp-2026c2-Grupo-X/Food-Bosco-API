import { ERROR_CODES } from '../config/constants'
import { sha256 } from '../config/crypto'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { RefreshTokenRepository } from './refresh-token.repository'
import { RefreshTokenService } from './refresh-token.service'

interface StoredRefreshToken {
  userId: string
  tokenHash: string
  expiresAt: Date
  revoked: boolean
}

const buildDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date(Date.now() + 60_000),
    revoked: false,
    ...overrides,
  }) as never

const expectInvalidRefreshToken = async (promise: Promise<unknown>): Promise<void> => {
  await expect(promise).rejects.toMatchObject({
    code: ERROR_CODES.invalidRefreshToken,
    message: 'Refresh token inválido',
    status: 401,
  })
}

const makeInMemoryRepository = () => {
  const store: StoredRefreshToken[] = []
  const repository = {
    create: jest.fn(async (data: Omit<StoredRefreshToken, 'revoked'>) => {
      const doc: StoredRefreshToken = { ...data, revoked: false }
      store.push(doc)
      return doc as never
    }),
    findByTokenHash: jest.fn(
      async (tokenHash: string) =>
        (store.find((doc) => doc.tokenHash === tokenHash) as never) ?? null,
    ),
    markRevokedByHash: jest.fn(async (tokenHash: string) => {
      store
        .filter((doc) => doc.tokenHash === tokenHash)
        .forEach((doc) => {
          doc.revoked = true
        })
    }),
    revokeAllForUser: jest.fn(async (userId: string) => {
      store
        .filter((doc) => doc.userId === userId)
        .forEach((doc) => {
          doc.revoked = true
        })
    }),
  }
  return { store, repository }
}

describe('RefreshTokenService.issue (RQ-AUTH-05, RQ-SEC-08)', () => {
  it('persiste el hash y devuelve el token crudo (nunca guarda el crudo)', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    const raw = await service.issue('u1')

    const data = repository.create.mock.calls[0][0]
    expect(data.userId).toBe('u1')
    expect(data.tokenHash).toBe(sha256(raw))
    expect(data.tokenHash).not.toBe(raw)
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('calcula expiresAt como ahora + refreshTokenTtlMs', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    const before = Date.now()
    await service.issue('u1')
    const after = Date.now()

    const data = repository.create.mock.calls[0][0]
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + env.refreshTokenTtlMs)
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(after + env.refreshTokenTtlMs)
  })

  it.each([
    { name: 'primer token', userId: 'u1' },
    { name: 'segundo usuario', userId: 'u2' },
    { name: 'usuario desconocido', userId: 'u-otro' },
  ])('asocia el token a $name', async ({ userId }) => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc({ userId })) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await service.issue(userId)

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ userId }))
  })

  it('genera un token crudo distinto en cada emisión', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    const first = await service.issue('u1')
    const second = await service.issue('u1')

    expect(first).not.toBe(second)
    expect(sha256(first)).not.toBe(sha256(second))
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

  it('busca por hash, nunca por el token crudo', async () => {
    const { repository, service } = makeService(buildDoc())

    await service.rotate('raw-token')

    expect(repository.findByTokenHash).toHaveBeenCalledWith(sha256('raw-token'))
    expect(repository.findByTokenHash).not.toHaveBeenCalledWith('raw-token')
  })

  it.each([
    { name: 'token inexistente', doc: null },
    { name: 'token revocado', doc: buildDoc({ revoked: true }) },
    { name: 'token expirado', doc: buildDoc({ expiresAt: new Date(Date.now() - 1_000) }) },
  ])('rechaza $name', async ({ doc }) => {
    const { service } = makeService(doc)

    await expectInvalidRefreshToken(service.rotate('raw-token'))
  })

  it('un token ya rotado no puede reutilizarse (single-use con repositorio real)', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)
    const raw = await service.issue('u1')

    const rotated = await service.rotate(raw)

    expect(rotated.userId).toBe('u1')
    await expectInvalidRefreshToken(service.rotate(raw))
  })

  it('el token nuevo emitido durante la rotación sí puede rotarse', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)
    const raw = await service.issue('u1')

    const first = await service.rotate(raw)
    const second = await service.rotate(first.refreshToken)

    expect(second.userId).toBe('u1')
    expect(second.refreshToken).not.toBe(first.refreshToken)
  })

  it('un token revocado en lote no puede rotarse', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)
    const raw = await service.issue('u1')

    await service.revokeAll('u1')

    await expectInvalidRefreshToken(service.rotate(raw))
  })

  it('propaga DomainException y no emite token nuevo cuando la rotación falla', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await expectInvalidRefreshToken(service.rotate('token-inexistente'))

    expect(repository.create).not.toHaveBeenCalled()
  })
})

describe('RefreshTokenService.revokeAll (RQ-AUTH-08)', () => {
  it('revoca todas las sesiones del usuario', async () => {
    const repository = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await service.revokeAll('u1')

    expect(repository.revokeAllForUser).toHaveBeenCalledWith('u1')
  })

  it('es idempotente: revocar dos veces delega igual sin fallar', async () => {
    const repository = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await service.revokeAll('u1')
    await service.revokeAll('u1')

    expect(repository.revokeAllForUser).toHaveBeenCalledTimes(2)
  })

  it('propaga el error del repositorio sin transformarlo', async () => {
    const repository = {
      revokeAllForUser: jest.fn().mockRejectedValue(new DomainException('DB', 'boom', 500)),
    }
    const service = new RefreshTokenService(repository as unknown as RefreshTokenRepository)

    await expect(service.revokeAll('u1')).rejects.toMatchObject({ code: 'DB', status: 500 })
  })
})
