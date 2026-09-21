import { Connection } from 'mongoose'
import { RiderService } from '../rider/rider.service'
import { ShiftService } from '../shift/shift.service'
import { ZoneService } from '../zone/zone.service'
import { SeedService } from './seed.service'

const buildConnection = (user: Record<string, unknown> | null = null): Connection =>
  ({
    db: {
      collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(user) }),
    },
  }) as unknown as Connection

describe('SeedService (delivery)', () => {
  it('seed crea zonas, turnos y enlaza el perfil del rider desde auth', async () => {
    const riderService = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u-rider' }),
    }
    const zoneService = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
        id: `z-${seed.name}`,
        name: seed.name,
      })),
    }
    const shiftService = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
        id: `s-${seed.name}`,
        name: seed.name,
      })),
    }
    const connection = buildConnection({
      _id: { toString: () => 'u-rider' },
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: 'Moto Honda CG Titan',
    })

    const service = new SeedService(
      riderService as unknown as RiderService,
      zoneService as unknown as ZoneService,
      shiftService as unknown as ShiftService,
      connection,
    )

    const result = await service.seed()

    expect(result.summary).toEqual({ zones: 3, shifts: 3, riders: 1 })
    expect(result.rider).toEqual({ id: 'r1', userId: 'u-rider' })
    expect(riderService.create).toHaveBeenCalledWith({
      userId: 'u-rider',
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: 'Moto Honda CG Titan',
    })
  })

  it('omite el rider cuando no existe el usuario en auth', async () => {
    const riderService = {
      findByUserId: jest.fn(),
      create: jest.fn(),
    }
    const zoneService = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
        id: `z-${seed.name}`,
        name: seed.name,
      })),
    }
    const shiftService = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (seed: { name: string }) => ({
        id: `s-${seed.name}`,
        name: seed.name,
      })),
    }

    const service = new SeedService(
      riderService as unknown as RiderService,
      zoneService as unknown as ZoneService,
      shiftService as unknown as ShiftService,
      buildConnection(null),
    )

    const result = await service.seed()

    expect(result.summary.riders).toBe(0)
    expect(result.rider).toBeNull()
    expect(riderService.create).not.toHaveBeenCalled()
  })

  it('seedRiderProfile es idempotente: devuelve el existente sin crear', async () => {
    const riderService = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1' }),
      create: jest.fn(),
    }
    const zoneService = { findByName: jest.fn(), create: jest.fn() }
    const shiftService = { findByName: jest.fn(), create: jest.fn() }

    const service = new SeedService(
      riderService as unknown as RiderService,
      zoneService as unknown as ZoneService,
      shiftService as unknown as ShiftService,
      buildConnection(),
    )

    const result = await service.seedRiderProfile({
      userId: 'u1',
      firstName: 'Marcos',
      lastName: 'Peralta',
      phone: '3333333333',
      vehicle: 'Moto Honda CG Titan',
    })

    expect(riderService.create).not.toHaveBeenCalled()
    expect(result.rider).toEqual({ id: 'r1', userId: 'u1' })
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
    const riderService = { findByUserId: jest.fn(), create: jest.fn() }

    const service = new SeedService(
      riderService as unknown as RiderService,
      zoneService as unknown as ZoneService,
      shiftService as unknown as ShiftService,
      buildConnection(),
    )

    const zones = await service.seedZones()
    const shifts = await service.seedShifts()

    expect(zones).toBe(0)
    expect(shifts).toBe(0)
    expect(zoneService.create).not.toHaveBeenCalled()
    expect(shiftService.create).not.toHaveBeenCalled()
  })
})
