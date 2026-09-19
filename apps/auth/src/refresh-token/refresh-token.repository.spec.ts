import type { Model } from 'mongoose'
import type { RefreshTokenDocument } from './refresh-token.model'
import { RefreshTokenRepository } from './refresh-token.repository'

interface Chainable<T> {
  exec: jest.Mock<Promise<T>, []>
}

const chainable = <T>(result: T): Chainable<T> => ({
  exec: jest.fn().mockResolvedValue(result),
})

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): RefreshTokenDocument =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    revoked: false,
    ...overrides,
  }) as unknown as RefreshTokenDocument

const makeRepository = () => {
  const model = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  }
  return {
    model,
    repository: new RefreshTokenRepository(model as unknown as Model<RefreshTokenDocument>),
  }
}

describe('RefreshTokenRepository.create (RQ-AUTH-05/08, RQ-SEC-08)', () => {
  it('persiste userId, tokenHash, expiresAt y revoked=false; nunca el token crudo', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())
    const expiresAt = new Date('2026-06-01T00:00:00.000Z')

    await repository.create({ userId: 'u1', tokenHash: 'hash-x', expiresAt })

    expect(model.create).toHaveBeenCalledWith({
      userId: 'u1',
      tokenHash: 'hash-x',
      expiresAt,
      revoked: false,
    })
    const persisted = model.create.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(persisted).sort()).toEqual(['expiresAt', 'revoked', 'tokenHash', 'userId'])
  })

  it.each([
    { name: 'hash corto', tokenHash: 'abc' },
    { name: 'hash de 64 hex', tokenHash: 'a'.repeat(64) },
    { name: 'hash vacío', tokenHash: '' },
  ])('persiste el hash tal cual llega ($name)', async ({ tokenHash }) => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc({ tokenHash }))

    await repository.create({ userId: 'u1', tokenHash, expiresAt: new Date() })

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ tokenHash }))
  })

  it('propaga el error de persistencia del modelo', async () => {
    const { model, repository } = makeRepository()
    model.create.mockRejectedValue(new Error('duplicate key'))

    await expect(
      repository.create({ userId: 'u1', tokenHash: 'h', expiresAt: new Date() }),
    ).rejects.toThrow('duplicate key')
  })
})

describe('RefreshTokenRepository.findByTokenHash (lookup por hash)', () => {
  it('consulta por tokenHash y ejecuta la query', async () => {
    const { model, repository } = makeRepository()
    const chain = chainable(buildDoc())
    model.findOne.mockReturnValue(chain)

    const result = await repository.findByTokenHash('hash-x')

    expect(model.findOne).toHaveBeenCalledWith({ tokenHash: 'hash-x' })
    expect(chain.exec).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ userId: 'u1' })
  })

  it('devuelve null cuando el hash no existe', async () => {
    const { model, repository } = makeRepository()
    model.findOne.mockReturnValue(chainable(null))

    await expect(repository.findByTokenHash('missing')).resolves.toBeNull()
  })
})

describe('RefreshTokenRepository.markRevokedByHash (RQ-AUTH-08)', () => {
  it('marca revoked=true filtrando por tokenHash', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true }))

    await repository.markRevokedByHash('hash-x')

    expect(model.updateOne).toHaveBeenCalledWith(
      { tokenHash: 'hash-x' },
      { $set: { revoked: true } },
    )
  })
})

describe('RefreshTokenRepository.revokeAllForUser (RQ-AUTH-08)', () => {
  it('revoca en lote solo los tokens vigentes del usuario (idempotente)', async () => {
    const { model, repository } = makeRepository()
    model.updateMany.mockReturnValue(chainable({ modifiedCount: 2 }))

    await repository.revokeAllForUser('u1')

    expect(model.updateMany).toHaveBeenCalledWith(
      { userId: 'u1', revoked: false },
      { $set: { revoked: true } },
    )
  })

  it.each([
    { name: 'usuario con sesiones', userId: 'u1' },
    { name: 'usuario sin sesiones', userId: 'u-vacio' },
    { name: 'usuario desconocido', userId: 'u-otro' },
  ])('filtra por $name sin tocar tokens de otros usuarios', async ({ userId }) => {
    const { model, repository } = makeRepository()
    model.updateMany.mockReturnValue(chainable({ modifiedCount: 0 }))

    await repository.revokeAllForUser(userId)

    expect(model.updateMany).toHaveBeenCalledTimes(1)
    expect(model.updateMany.mock.calls[0][0]).toEqual({ userId, revoked: false })
  })
})
