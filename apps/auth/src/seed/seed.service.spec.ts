import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { UserService, PublicUser } from '../user/user.service'
import { SeedService } from './seed.service'

const publicUser = (overrides: Partial<PublicUser> = {}): PublicUser => ({
  id: 'u1',
  email: 'admin@foodbosco.local',
  role: 'super_admin',
  firstName: 'Super',
  lastName: 'Admin',
  phone: '0000000000',
  active: true,
  branchId: null,
  vehicle: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('SeedService (auth)', () => {
  it('sin branchId crea superAdmin, customer y rider y omite branchAdmin', async () => {
    const userService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest
        .fn()
        .mockImplementation(async (input: { email: string }) =>
          publicUser({ id: input.email, email: input.email, role: 'customer' }),
        ),
    }
    const service = new SeedService(userService as unknown as UserService)

    const result = await service.seed()

    expect(result.summary.users).toBe(3)
    const createdEmails = userService.createUser.mock.calls.map((call) => call[0].email)
    expect(createdEmails).toEqual([
      'admin@foodbosco.local',
      'cliente@foodbosco.local',
      'repartidor@foodbosco.local',
    ])
    expect(createdEmails).not.toContain('sucursal@foodbosco.local')
  })

  it('con branchId crea también branchAdmin con ese branchId', async () => {
    const userService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest
        .fn()
        .mockImplementation(async (input: { email: string; branchId?: string | null }) =>
          publicUser({ id: input.email, email: input.email, branchId: input.branchId ?? null }),
        ),
    }
    const service = new SeedService(userService as unknown as UserService)

    const result = await service.seed('b1')

    expect(result.summary.users).toBe(4)
    const branchAdminCall = userService.createUser.mock.calls.find(
      (call) => call[0].email === 'sucursal@foodbosco.local',
    )
    expect(branchAdminCall?.[0].branchId).toBe('b1')
  })

  it('es idempotente: no crea usuarios que ya existen', async () => {
    const userService = {
      findByEmail: jest.fn().mockResolvedValue(publicUser()),
      createUser: jest.fn(),
    }
    const service = new SeedService(userService as unknown as UserService)

    const result = await service.seed()

    expect(userService.createUser).not.toHaveBeenCalled()
    expect(result.summary.users).toBe(3)
  })

  it('tolera la carrera de creación (email tomado) devolviendo el existente', async () => {
    const existing = publicUser({ email: 'repartidor@foodbosco.local', role: 'rider' })
    const userService = {
      findByEmail: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(existing),
      createUser: jest
        .fn()
        .mockImplementationOnce(async (input: { email: string }) =>
          publicUser({ id: input.email, email: input.email }),
        )
        .mockImplementationOnce(async (input: { email: string }) =>
          publicUser({ id: input.email, email: input.email }),
        )
        .mockRejectedValueOnce(
          new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409),
        ),
    }
    const service = new SeedService(userService as unknown as UserService)

    const result = await service.seed()

    expect(result.users.map((user) => user.email)).toContain('repartidor@foodbosco.local')
    expect(userService.createUser).toHaveBeenCalledTimes(3)
  })
})
