import { ERROR_CODES } from '../config/constants'
import { sha256 } from '../config/crypto'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { PasswordRecoveryRepository } from './password-recovery.repository'
import { PasswordRecoveryService } from './password-recovery.service'

interface StoredRecoveryToken {
  userId: string
  tokenHash: string
  expiresAt: Date
  used: boolean
}

const buildDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date(Date.now() + 60_000),
    used: false,
    ...overrides,
  }) as never

const expectInvalidOrExpired = async (promise: Promise<unknown>): Promise<void> => {
  await expect(promise).rejects.toMatchObject({
    code: ERROR_CODES.invalidOrExpiredToken,
    message: 'Token inválido o expirado',
    status: 400,
  })
}

const makeInMemoryRepository = () => {
  const store: StoredRecoveryToken[] = []
  const repository = {
    create: jest.fn(async (data: Omit<StoredRecoveryToken, 'used'>) => {
      const doc: StoredRecoveryToken = { ...data, used: false }
      store.push(doc)
      return doc as never
    }),
    findByTokenHash: jest.fn(
      async (tokenHash: string) =>
        (store.find((doc) => doc.tokenHash === tokenHash) as never) ?? null,
    ),
    markUsedByHash: jest.fn(async (tokenHash: string) => {
      store
        .filter((doc) => doc.tokenHash === tokenHash)
        .forEach((doc) => {
          doc.used = true
        })
    }),
  }
  return { store, repository }
}

describe('PasswordRecoveryService.create (RQ-AUTH-10, RQ-SEC-08)', () => {
  it('persiste el hash y devuelve el token crudo con expiración', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)

    const raw = await service.create('u1')

    const data = repository.create.mock.calls[0][0]
    expect(data.userId).toBe('u1')
    expect(data.tokenHash).toBe(sha256(raw))
    expect(data.tokenHash).not.toBe(raw)
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('calcula expiresAt como ahora + passwordRecoveryTtlMs', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)

    const before = Date.now()
    await service.create('u1')
    const after = Date.now()

    const data = repository.create.mock.calls[0][0]
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + env.passwordRecoveryTtlMs)
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(after + env.passwordRecoveryTtlMs)
  })

  it.each([
    { name: 'primer pedido', userId: 'u1' },
    { name: 'otro usuario', userId: 'u2' },
    { name: 'usuario desconocido', userId: 'u-otro' },
  ])('asocia el token a $name', async ({ userId }) => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc({ userId })) }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)

    await service.create(userId)

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ userId }))
  })

  it('genera un token crudo distinto en cada solicitud', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)

    const first = await service.create('u1')
    const second = await service.create('u1')

    expect(first).not.toBe(second)
    expect(sha256(first)).not.toBe(sha256(second))
  })
})

describe('PasswordRecoveryService.consume (RQ-AUTH-10, RQ-SEC-08)', () => {
  const makeService = (doc: ReturnType<typeof buildDoc> | null) => {
    const repository = {
      findByTokenHash: jest.fn().mockResolvedValue(doc),
      markUsedByHash: jest.fn().mockResolvedValue(undefined),
    }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)
    return { repository, service }
  }

  it('consume un token válido, lo marca usado y devuelve el userId', async () => {
    const { repository, service } = makeService(buildDoc())

    const userId = await service.consume('raw-token')

    expect(userId).toBe('u1')
    expect(repository.markUsedByHash).toHaveBeenCalledWith(sha256('raw-token'))
  })

  it('busca por hash, nunca por el token crudo', async () => {
    const { repository, service } = makeService(buildDoc())

    await service.consume('raw-token')

    expect(repository.findByTokenHash).toHaveBeenCalledWith(sha256('raw-token'))
    expect(repository.findByTokenHash).not.toHaveBeenCalledWith('raw-token')
  })

  it.each([
    { name: 'token inexistente', doc: null },
    { name: 'token ya usado', doc: buildDoc({ used: true }) },
    { name: 'token expirado', doc: buildDoc({ expiresAt: new Date(Date.now() - 1_000) }) },
  ])('rechaza $name', async ({ doc }) => {
    const { service } = makeService(doc)

    await expectInvalidOrExpired(service.consume('raw-token'))
  })

  it('no marca usado un token que no existe', async () => {
    const { repository, service } = makeService(null)

    await expectInvalidOrExpired(service.consume('raw-token'))

    expect(repository.markUsedByHash).not.toHaveBeenCalled()
  })

  it('un token válido es de un solo uso (con repositorio real)', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)
    const raw = await service.create('u1')

    const userId = await service.consume(raw)

    expect(userId).toBe('u1')
    await expectInvalidOrExpired(service.consume(raw))
  })

  it('cada token generado se consume de forma independiente', async () => {
    const { repository } = makeInMemoryRepository()
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)
    const first = await service.create('u1')
    const second = await service.create('u1')

    await service.consume(first)

    await expect(service.consume(second)).resolves.toBe('u1')
  })

  it('propaga DomainException y no marca usado cuando el token expiró', async () => {
    const expired = buildDoc({ expiresAt: new Date(Date.now() - 1) })
    const { repository, service } = makeService(expired)

    await expectInvalidOrExpired(service.consume('raw-token'))

    expect(repository.markUsedByHash).not.toHaveBeenCalled()
  })

  it('propaga el error inesperado del repositorio', async () => {
    const repository = {
      findByTokenHash: jest.fn().mockRejectedValue(new DomainException('DB', 'boom', 500)),
      markUsedByHash: jest.fn(),
    }
    const service = new PasswordRecoveryService(repository as unknown as PasswordRecoveryRepository)

    await expect(service.consume('raw-token')).rejects.toMatchObject({ code: 'DB', status: 500 })
  })
})
