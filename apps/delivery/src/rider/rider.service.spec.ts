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
    vehicle: 'Moto',
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
      vehicle: 'Moto',
      phone: '11223344',
    })

    expect(result.id).toBe('r1')
    expect(result.vehicle).toBe('Moto')
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
