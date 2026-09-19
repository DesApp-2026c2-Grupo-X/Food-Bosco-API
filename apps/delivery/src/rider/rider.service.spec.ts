import { RIDER_STATUS } from '../config/constants'
import { Rider, RiderDocument } from './rider.model'
import { RiderRepository } from './rider.repository'
import { RiderService } from './rider.service'

const buildDoc = (overrides: Partial<Rider> = {}): RiderDocument =>
  ({
    _id: { toString: () => 'r1' },
    userId: 'u1',
    firstName: 'Juan',
    lastName: 'Perez',
    vehicle: { type: 'moto', brand: 'Honda' },
    phone: '11223344',
    available: false,
    status: RIDER_STATUS.offline,
    currentLocation: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as RiderDocument

describe('RiderService.setAvailability (RQ-DLV-01)', () => {
  const repository = { setAvailability: jest.fn() }
  const service = new RiderService(repository as unknown as RiderRepository)

  beforeEach(() => jest.clearAllMocks())

  it.each([
    { online: true, expected: RIDER_STATUS.free },
    { online: false, expected: RIDER_STATUS.offline },
  ])('online=$online → status $expected', async ({ online, expected }) => {
    repository.setAvailability.mockResolvedValue(buildDoc({ available: online, status: expected }))

    const result = await service.setAvailability('u1', online)

    expect(repository.setAvailability).toHaveBeenCalledWith('u1', online, expected)
    expect(result?.available).toBe(online)
    expect(result?.status).toBe(expected)
  })
})

describe('RiderService.updateLocation (RQ-DLV-02)', () => {
  it('persiste la ubicación y serializa el resultado', async () => {
    const repository = {
      setLocation: jest
        .fn()
        .mockResolvedValue(buildDoc({ currentLocation: { latitude: -34.6, longitude: -58.4 } })),
    }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.updateLocation('u1', -34.6, -58.4)

    expect(repository.setLocation).toHaveBeenCalledWith('u1', {
      latitude: -34.6,
      longitude: -58.4,
    })
    expect(result?.currentLocation).toEqual({ latitude: -34.6, longitude: -58.4 })
  })
})

describe('RiderService.findByUserId / create / setStatus', () => {
  it('findByUserId devuelve null si no existe', async () => {
    const repository = { findByUserId: jest.fn().mockResolvedValue(null) }
    const service = new RiderService(repository as unknown as RiderRepository)

    await expect(service.findByUserId('u1')).resolves.toBeNull()
  })

  it('create serializa el rider con snapshot', async () => {
    const repository = { create: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.create({
      userId: 'u1',
      firstName: 'Juan',
      lastName: 'Perez',
      vehicle: { type: 'moto', brand: 'Honda' },
      phone: '11223344',
    })

    expect(result.id).toBe('r1')
    expect(result.vehicle).toEqual({ type: 'moto', brand: 'Honda' })
  })

  it('setStatus actualiza y serializa', async () => {
    const repository = {
      setStatus: jest.fn().mockResolvedValue(buildDoc({ status: RIDER_STATUS.onTrip })),
    }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.setStatus('u1', RIDER_STATUS.onTrip)

    expect(repository.setStatus).toHaveBeenCalledWith('u1', RIDER_STATUS.onTrip)
    expect(result?.status).toBe(RIDER_STATUS.onTrip)
  })
})

describe('RiderService.findByUserId (RQ-DLV-11)', () => {
  it('serializa el documento y no filtra campos internos', async () => {
    const repository = { findByUserId: jest.fn().mockResolvedValue(buildDoc()) }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.findByUserId('u1')

    expect(repository.findByUserId).toHaveBeenCalledWith('u1')
    expect(result?.id).toBe('r1')
    expect(result).not.toHaveProperty('_id')
    expect(result).not.toHaveProperty('createdAt')
  })
})

describe('RiderService.listAvailable', () => {
  it('serializa todos los riders devueltos', async () => {
    const repository = {
      findAllAvailable: jest.fn().mockResolvedValue([buildDoc(), buildDoc({ userId: 'u2' })]),
    }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.listAvailable()

    expect(repository.findAllAvailable).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
    expect(result[0].userId).toBe('u1')
    expect(result[1].userId).toBe('u2')
  })

  it('devuelve arreglo vacío si no hay riders disponibles', async () => {
    const repository = { findAllAvailable: jest.fn().mockResolvedValue([]) }
    const service = new RiderService(repository as unknown as RiderRepository)

    await expect(service.listAvailable()).resolves.toEqual([])
  })
})

describe('RiderService.updateProfile / updateVehicle (RQ-DLV-11)', () => {
  it('updateProfile serializa el documento actualizado', async () => {
    const repository = { updateProfile: jest.fn().mockResolvedValue(buildDoc({ phone: '999' })) }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.updateProfile('u1', { phone: '999' })

    expect(repository.updateProfile).toHaveBeenCalledWith('u1', { phone: '999' })
    expect(result?.phone).toBe('999')
  })

  it('updateProfile devuelve null si el rider no existe', async () => {
    const repository = { updateProfile: jest.fn().mockResolvedValue(null) }
    const service = new RiderService(repository as unknown as RiderRepository)

    await expect(service.updateProfile('u1', { phone: '999' })).resolves.toBeNull()
  })

  it('updateVehicle delega el vehículo y lo serializa', async () => {
    const repository = {
      updateVehicle: jest.fn().mockResolvedValue(buildDoc({ vehicle: { type: 'bici' } })),
    }
    const service = new RiderService(repository as unknown as RiderRepository)

    const result = await service.updateVehicle('u1', { type: 'bici' })

    expect(repository.updateVehicle).toHaveBeenCalledWith('u1', { type: 'bici' })
    expect(result?.vehicle).toEqual({ type: 'bici' })
  })

  it('updateVehicle devuelve null si el rider no existe', async () => {
    const repository = { updateVehicle: jest.fn().mockResolvedValue(null) }
    const service = new RiderService(repository as unknown as RiderRepository)

    await expect(service.updateVehicle('u1', { type: 'moto' })).resolves.toBeNull()
  })
})
