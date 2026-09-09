import { ERROR_CODES } from '../config/constants'
import { sha256 } from '../config/crypto'
import { PasswordRecoveryRepository } from './password-recovery.repository'
import { PasswordRecoveryService } from './password-recovery.service'

const buildDoc = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'u1',
    tokenHash: 'hash-x',
    expiresAt: new Date(Date.now() + 60_000),
    used: false,
    ...overrides,
  }) as never

describe('PasswordRecoveryService.create (RQ-AUTH-10)', () => {
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

  it('consume un token válido y lo marca como usado', async () => {
    const { repository, service } = makeService(buildDoc())

    const userId = await service.consume('raw-token')

    expect(userId).toBe('u1')
    expect(repository.markUsedByHash).toHaveBeenCalledWith(sha256('raw-token'))
  })

  it.each([
    { name: 'token inexistente', doc: null },
    { name: 'token ya usado', doc: buildDoc({ used: true }) },
    { name: 'token expirado', doc: buildDoc({ expiresAt: new Date(Date.now() - 1_000) }) },
  ])('rechaza $name', async ({ doc }) => {
    const { service } = makeService(doc)

    await expect(service.consume('raw-token')).rejects.toMatchObject({
      code: ERROR_CODES.invalidOrExpiredToken,
    })
  })
})
