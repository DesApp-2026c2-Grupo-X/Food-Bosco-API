import type { PublicAddress } from '../address/address.model'
import type { AddressService } from '../address/address.service'
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

const publicAddress = (overrides: Partial<PublicAddress> = {}): PublicAddress => ({
  id: 'a1',
  label: 'Casa',
  text: 'Calle 1',
  city: null,
  postalCode: null,
  latitude: -34.6,
  longitude: -58.4,
  active: true,
  ...overrides,
})

const buildUserService = (overrides: Partial<UserService> = {}) =>
  ({
    findByEmail: jest.fn().mockResolvedValue(null),
    createUser: jest
      .fn()
      .mockImplementation(async (input: { email: string; branchId?: string | null }) =>
        publicUser({ id: input.email, email: input.email, branchId: input.branchId ?? null }),
      ),
    ...overrides,
  }) as unknown as UserService

const buildAddressService = (overrides: Partial<AddressService> = {}) =>
  ({
    listByUser: jest.fn().mockResolvedValue({ data: [] }),
    create: jest
      .fn()
      .mockImplementation(async (_userId: string, data: { label: string; text: string }) =>
        publicAddress({ id: `a-${data.label}`, label: data.label, text: data.text }),
      ),
    ...overrides,
  }) as unknown as AddressService

const instantiate = (userService: UserService, addressService: AddressService) =>
  new SeedService(userService, addressService)

describe('SeedService (auth) — usuarios', () => {
  it('crea los usuarios base sin branch_admin y siembra las direcciones del customer', async () => {
    const userService = buildUserService()
    const addressService = buildAddressService()

    const result = await instantiate(userService, addressService).seed()

    expect(result.summary.users).toBe(3)
    expect(result.summary.addresses).toBe(2)
    expect(userService.createUser).toHaveBeenCalledTimes(3)

    const createdEmails = (userService.createUser as jest.Mock).mock.calls.map(
      (call) => call[0].email,
    )
    expect(createdEmails).toEqual([
      'admin@foodbosco.local',
      'cliente@foodbosco.local',
      'repartidor@foodbosco.local',
    ])

    const customerId = result.users.find((user) => user.email === 'cliente@foodbosco.local')?.id
    const addressOwners = (addressService.create as jest.Mock).mock.calls.map((call) => call[0])
    expect(new Set(addressOwners)).toEqual(new Set([customerId]))
  })

  it('con branchId crea el branch_admin legacy con ese branchId', async () => {
    const userService = buildUserService()
    const service = instantiate(userService, buildAddressService())

    const result = await service.seed({ branchId: 'b1' })

    expect(result.summary.users).toBe(4)
    const call = (userService.createUser as jest.Mock).mock.calls.find(
      (entry) => entry[0].email === 'sucursal@foodbosco.local',
    )
    expect(call?.[0].branchId).toBe('b1')
  })

  it.each([
    {
      name: 'tres sucursales',
      branches: [
        { id: 'b1', name: 'Centro' },
        { id: 'b2', name: 'Norte' },
        { id: 'b3', name: 'Oeste' },
      ],
      expected: [
        { email: 'sucursal.centro@foodbosco.local', branchId: 'b1' },
        { email: 'sucursal.norte@foodbosco.local', branchId: 'b2' },
        { email: 'sucursal.oeste@foodbosco.local', branchId: 'b3' },
      ],
    },
    {
      name: 'sucursal desconocida (sin match)',
      branches: [{ id: 'b9', name: 'Desconocida' }],
      expected: [],
    },
  ])(
    'con branches $name crea un admin por sucursal coincidente',
    async ({ branches, expected }) => {
      const userService = buildUserService()
      const service = instantiate(userService, buildAddressService())

      const result = await service.seed({ branches })

      expect(result.summary.users).toBe(3 + expected.length)
      const adminCalls = (userService.createUser as jest.Mock).mock.calls.filter(
        (call) => call[0].role === 'branch_admin',
      )
      expect(
        adminCalls.map((call) => ({ email: call[0].email, branchId: call[0].branchId })),
      ).toEqual(expected)
    },
  )

  it('es idempotente: no crea usuarios ni direcciones que ya existen', async () => {
    const userService = buildUserService({
      findByEmail: jest.fn().mockResolvedValue(publicUser({ id: 'u-existing' })),
    })
    const addressService = buildAddressService({
      listByUser: jest.fn().mockResolvedValue({
        data: [
          publicAddress({ id: 'a-casa', label: 'Casa' }),
          publicAddress({ id: 'a-trabajo', label: 'Trabajo' }),
        ],
      }),
    })

    const result = await instantiate(userService, addressService).seed()

    expect(userService.createUser).not.toHaveBeenCalled()
    expect(addressService.create).not.toHaveBeenCalled()
    expect(result.summary.users).toBe(3)
    expect(result.addresses[0]).toMatchObject({ userId: 'u-existing', id: 'a-casa', label: 'Casa' })
  })

  it('tolera la carrera de creación (email tomado) devolviendo el existente', async () => {
    const existing = publicUser({
      id: 'u-rider',
      email: 'repartidor@foodbosco.local',
      role: 'rider',
    })
    const userService = buildUserService({
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
    })

    const result = await instantiate(userService, buildAddressService()).seed()

    expect(result.users.map((user) => user.email)).toContain('repartidor@foodbosco.local')
    expect(userService.createUser).toHaveBeenCalledTimes(3)
  })
})
