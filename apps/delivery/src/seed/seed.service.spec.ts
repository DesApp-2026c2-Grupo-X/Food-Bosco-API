import { Connection } from 'mongoose'

import type { DeliveryOrderRepository } from '../delivery-order/delivery-order.repository'
import { RiderService } from '../rider/rider.service'
import { ShiftService } from '../shift/shift.service'
import { ZoneService } from '../zone/zone.service'
import { SeedService, type SeedRiderInput } from './seed.service'

const buildConnection = (user: Record<string, unknown> | null = null): Connection =>
  ({
    db: {
      collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) }),
    },
  }) as unknown as Connection

const buildRepo = (overrides: Record<string, unknown> = {}) => ({
  upsertReady: jest.fn().mockResolvedValue({ orderId: 'o1' }),
  ...overrides,
})

const buildService = (deps: {
  rider: unknown
  zone?: unknown
  shift?: unknown
  repo?: unknown
  connection?: Connection
}) =>
  new SeedService(
    deps.rider as RiderService,
    (deps.zone ?? { findByName: jest.fn(), create: jest.fn() }) as ZoneService,
    (deps.shift ?? { findByName: jest.fn(), create: jest.fn() }) as ShiftService,
    (deps.repo ?? buildRepo()) as DeliveryOrderRepository,
    deps.connection ?? buildConnection(),
  )

const zoneStub = () => ({
  findByName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
    id: `z-${seed.name}`,
    name: seed.name,
  })),
})

const shiftStub = () => ({
  findByName: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
    id: `s-${seed.name}`,
    name: seed.name,
  })),
})

const riderStub = (overrides: Record<string, unknown> = {}) =>
  ({
    findByUserId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u-rider' }),
    setAvailability: jest.fn().mockResolvedValue(null),
    updateLocation: jest.fn().mockResolvedValue(null),
    ...overrides,
  }) as unknown as RiderService & {
    create: jest.Mock
    setAvailability: jest.Mock
    updateLocation: jest.Mock
  }

describe('SeedService (delivery)', () => {
  it('seed crea zonas, turnos y enlaza el perfil del rider desde auth', async () => {
    const riderService = riderStub()
    const connection = buildConnection({
      _id: { toString: () => 'u-rider' },
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: 'Moto Honda CG Titan',
    })

    const service = buildService({
      rider: riderService,
      zone: zoneStub(),
      shift: shiftStub(),
      connection,
    })

    const result = await service.seed()

    expect(result.summary).toEqual({ zones: 3, shifts: 3, riders: 1 })
    expect(result.rider).toEqual({ id: 'r1', userId: 'u-rider' })
    expect(result.readyOrderId).toBeNull()
    expect(riderService.create).toHaveBeenCalledWith({
      userId: 'u-rider',
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: { type: 'moto', model: 'Moto Honda CG Titan' },
    })
  })

  it('omite el rider cuando no existe el usuario en auth', async () => {
    const riderService = riderStub({ findByUserId: jest.fn(), create: jest.fn() })

    const service = buildService({
      rider: riderService,
      zone: zoneStub(),
      shift: shiftStub(),
      connection: buildConnection(null),
    })

    const result = await service.seed()

    expect(result.summary.riders).toBe(0)
    expect(result.rider).toBeNull()
    expect(riderService.create).not.toHaveBeenCalled()
  })

  it('seedRiderProfile es idempotente: devuelve el existente sin crear', async () => {
    const riderService = riderStub({
      findByUserId: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1' }),
      create: jest.fn(),
    })

    const result = await buildService({ rider: riderService }).seedRiderProfile({
      userId: 'u1',
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: 'Moto Honda CG Titan',
    })

    expect(riderService.create).not.toHaveBeenCalled()
    expect(result.rider).toEqual({ id: 'r1', userId: 'u1' })
  })

  it.each([
    {
      name: 'moto',
      vehicle: 'Moto Honda CG Titan',
      expected: { type: 'moto', model: 'Moto Honda CG Titan' },
    },
    {
      name: 'bicicleta',
      vehicle: 'Bici rodado 29',
      expected: { type: 'bici', model: 'Bici rodado 29' },
    },
    { name: 'sin vehículo', vehicle: null, expected: null },
  ])('normaliza el vehículo ($name) al crear el perfil', async ({ vehicle, expected }) => {
    const riderService = riderStub()

    await buildService({ rider: riderService }).seedRiderProfile({
      userId: 'u1',
      firstName: 'A',
      lastName: 'B',
      phone: '1',
      vehicle,
    })

    expect(riderService.create).toHaveBeenCalledWith(expect.objectContaining({ vehicle: expected }))
  })

  it('seedZones/seedShifts omiten los que ya existen', async () => {
    const zoneService = {
      findByName: jest.fn().mockResolvedValue({ id: 'z1', name: 'Centro' }),
      create: jest.fn(),
    }
    const shiftService = {
      findByName: jest.fn().mockResolvedValue({ id: 's1', name: 'Mañana' }),
      create: jest.fn(),
    }

    const service = buildService({
      rider: riderStub({ findByUserId: jest.fn(), create: jest.fn() }),
      zone: zoneService,
      shift: shiftService,
    })

    const zones = await service.seedZones()
    const shifts = await service.seedShifts()

    expect(zones).toBe(0)
    expect(shifts).toBe(0)
    expect(zoneService.create).not.toHaveBeenCalled()
    expect(shiftService.create).not.toHaveBeenCalled()
  })

  describe('presencia y pedido listo para ofertas', () => {
    const baseInput: SeedRiderInput = {
      userId: 'u1',
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '333',
    }

    it('aplica disponibilidad y ubicación cuando se proveen', async () => {
      const riderService = riderStub()

      await buildService({ rider: riderService }).seedRiderProfile({
        ...baseInput,
        available: true,
        location: { latitude: -34.589, longitude: -58.636 },
      })

      expect(riderService.setAvailability).toHaveBeenCalledWith('u1', true)
      expect(riderService.updateLocation).toHaveBeenCalledWith('u1', -34.589, -58.636)
    })

    it('no toca la presencia si no se especifica', async () => {
      const riderService = riderStub()

      await buildService({ rider: riderService }).seedRiderProfile(baseInput)

      expect(riderService.setAvailability).not.toHaveBeenCalled()
      expect(riderService.updateLocation).not.toHaveBeenCalled()
    })

    it('marca un pedido listo para ofertas y devuelve su id', async () => {
      const repo = buildRepo()

      const result = await buildService({ rider: riderStub(), repo }).seedRiderProfile({
        ...baseInput,
        readyOrder: {
          orderId: 'o1',
          branchId: 'b1',
          branchLocation: { latitude: -34.589, longitude: -58.636 },
          deliveryAddress: { text: 'Calle 1', latitude: -34.6, longitude: -58.4 },
        },
      })

      expect(repo.upsertReady).toHaveBeenCalledWith({
        orderId: 'o1',
        branchId: 'b1',
        branchLocation: { latitude: -34.589, longitude: -58.636 },
        deliveryAddress: { text: 'Calle 1', latitude: -34.6, longitude: -58.4 },
      })
      expect(result.readyOrderId).toBe('o1')
    })

    it('sin pedido listo no genera oferta', async () => {
      const repo = buildRepo()

      const result = await buildService({ rider: riderStub(), repo }).seedRiderProfile(baseInput)

      expect(repo.upsertReady).not.toHaveBeenCalled()
      expect(result.readyOrderId).toBeNull()
    })
  })
})
