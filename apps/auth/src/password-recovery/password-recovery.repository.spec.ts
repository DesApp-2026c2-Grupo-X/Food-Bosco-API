import type { Model } from 'mongoose'
import type { PasswordRecoveryDocument } from './password-recovery.model'
import { PasswordRecoveryRepository } from './password-recovery.repository'

interface Chainable<T> {
  exec: jest.Mock<Promise<T>, []>
}

const chainable = <T>(result: T): Chainable<T> => ({
  exec: jest.fn().mockResolvedValue(result),
})

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): PasswordRecoveryDocument =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    used: false,
    ...overrides,
  }) as unknown as PasswordRecoveryDocument

const makeRepository = () => {
  const model = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  }
  return {
    model,
    repository: new PasswordRecoveryRepository(model as unknown as Model<PasswordRecoveryDocument>),
  }
}

describe('PasswordRecoveryRepository.create (RQ-AUTH-10, RQ-SEC-08)', () => {
  it('persiste userId, tokenHash, expiresAt y used=false; nunca el token crudo', async () => {
    const { model, repository } = makeRepository()
    model.create.mockResolvedValue(buildDoc())
    const expiresAt = new Date('2026-06-01T00:00:00.000Z')

    await repository.create({ userId: 'u1', tokenHash: 'hash-x', expiresAt })

    expect(model.create).toHaveBeenCalledWith({
      userId: 'u1',
      tokenHash: 'hash-x',
      expiresAt,
      used: false,
    })
    const persisted = model.create.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(persisted).sort()).toEqual(['expiresAt', 'tokenHash', 'used', 'userId'])
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
    model.create.mockRejectedValue(new Error('write failed'))

    await expect(
      repository.create({ userId: 'u1', tokenHash: 'h', expiresAt: new Date() }),
    ).rejects.toThrow('write failed')
  })
})

describe('PasswordRecoveryRepository.findByTokenHash (lookup por hash)', () => {
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

describe('PasswordRecoveryRepository.markUsedByHash (RQ-SEC-08)', () => {
  it('marca used=true filtrando por tokenHash (un solo uso)', async () => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true }))

    await repository.markUsedByHash('hash-x')

    expect(model.updateOne).toHaveBeenCalledWith({ tokenHash: 'hash-x' }, { $set: { used: true } })
  })

  it.each([
    { name: 'hash de un token vigente', tokenHash: 'hash-x' },
    { name: 'hash inexistente', tokenHash: 'missing' },
    { name: 'hash vacío', tokenHash: '' },
  ])('envía el mismo update para $name', async ({ tokenHash }) => {
    const { model, repository } = makeRepository()
    model.updateOne.mockReturnValue(chainable({ acknowledged: true }))

    await repository.markUsedByHash(tokenHash)

    expect(model.updateOne).toHaveBeenCalledTimes(1)
    expect(model.updateOne).toHaveBeenCalledWith({ tokenHash }, { $set: { used: true } })
  })
})
