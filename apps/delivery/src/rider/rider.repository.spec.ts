import type { Model } from 'mongoose'
import { RIDER_STATUS } from '../config/constants'
import type { RiderStatus } from '../config/constants'
import type { RiderDocument } from './rider.model'
import { RiderRepository } from './rider.repository'
import type { CreateRiderData, UpdateRiderProfileData } from './rider.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const model = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }
  const repository = new RiderRepository(model as unknown as Model<RiderDocument>)
  return { repository, model }
}

describe('RiderRepository.findByUserId / findAllAvailable', () => {
  it('findByUserId filtra por userId y devuelve el documento', async () => {
    const { repository, model } = makeRepository()
    const doc = { userId: 'u1' }
    model.findOne.mockReturnValue(execQuery(doc))

    const result = await repository.findByUserId('u1')

    expect(model.findOne).toHaveBeenCalledWith({ userId: 'u1' })
    expect(result).toBe(doc)
  })

  it('findByUserId devuelve null cuando no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOne.mockReturnValue(execQuery(null))

    await expect(repository.findByUserId('u1')).resolves.toBeNull()
  })

  it.each([
    { name: 'con resultados', docs: [{ userId: 'u1' }, { userId: 'u2' }] },
    { name: 'sin resultados', docs: [] },
  ])('findAllAvailable filtra available=true ($name)', async ({ docs }) => {
    const { repository, model } = makeRepository()
    model.find.mockReturnValue(execQuery(docs))

    const result = await repository.findAllAvailable()

    expect(model.find).toHaveBeenCalledWith({ available: true })
    expect(result).toBe(docs)
  })
})

describe('RiderRepository.create (onboarding lazy, RQ-DLV-11)', () => {
  const cases: Array<{ name: string; data: CreateRiderData }> = [
    {
      name: 'sin vehículo',
      data: { userId: 'u1', firstName: 'Juan', lastName: 'Perez', vehicle: null, phone: '1' },
    },
    {
      name: 'con vehículo moto',
      data: {
        userId: 'u2',
        firstName: 'Ana',
        lastName: 'Gomez',
        vehicle: { type: 'moto', brand: 'Honda' },
        phone: '2',
      },
    },
    {
      name: 'con vehículo bici',
      data: {
        userId: 'u3',
        firstName: 'Luis',
        lastName: 'Diaz',
        vehicle: { type: 'bici' },
        phone: '3',
      },
    },
  ]

  it.each(cases)('aplica defaults del dominio ($name)', async ({ data }) => {
    const { repository, model } = makeRepository()
    const doc = { userId: data.userId }
    model.create.mockResolvedValue(doc)

    const result = await repository.create(data)

    expect(model.create).toHaveBeenCalledWith({
      ...data,
      available: false,
      status: RIDER_STATUS.offline,
      currentLocation: null,
    })
    expect(result).toBe(doc)
  })
})

describe('RiderRepository.updateProfile / updateVehicle (RQ-DLV-11)', () => {
  const cases: Array<{ name: string; patch: UpdateRiderProfileData }> = [
    { name: 'solo teléfono', patch: { phone: '999' } },
    { name: 'patch vacío', patch: {} },
    { name: 'teléfono de 50 caracteres', patch: { phone: '1'.repeat(50) } },
  ]

  it.each(cases)('hace $set del patch sin tocar otros campos ($name)', async ({ patch }) => {
    const { repository, model } = makeRepository()
    const doc = { userId: 'u1' }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.updateProfile('u1', patch)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: patch },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si el rider no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.updateProfile('u1', { phone: '999' })).resolves.toBeNull()
  })

  it('updateVehicle reemplaza el objeto vehicle completo', async () => {
    const { repository, model } = makeRepository()
    const doc = { userId: 'u1' }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.updateVehicle('u1', {
      type: 'bici',
      brand: 'Rali',
      plate: 'AB1',
    })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { vehicle: { type: 'bici', brand: 'Rali', plate: 'AB1' } } },
      { new: true },
    )
    expect(result).toBe(doc)
  })
})

describe('RiderRepository.setAvailability (RQ-DLV-01)', () => {
  const cases: Array<{
    name: string
    available: boolean
    status: RiderStatus
    withLastSeen: boolean
  }> = [
    { name: 'se pone online', available: true, status: RIDER_STATUS.free, withLastSeen: true },
    { name: 'se pone offline', available: false, status: RIDER_STATUS.offline, withLastSeen: false },
    { name: 'vuelve a online', available: true, status: RIDER_STATUS.free, withLastSeen: true },
  ]

  it.each(cases)('$name → $set con estado derivado', async ({ available, status, withLastSeen }) => {
    const { repository, model } = makeRepository()
    const doc = { userId: 'u1' }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.setAvailability('u1', available, status)

    const expectedSet = withLastSeen
      ? { available, status, lastSeenAt: expect.any(Date) }
      : { available, status }
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: expectedSet },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('offline no registra lastSeenAt', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await repository.setAvailability('u1', false, RIDER_STATUS.offline)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { available: false, status: RIDER_STATUS.offline } },
      { new: true },
    )
  })
})

describe('RiderRepository.setLocation (RQ-DLV-02)', () => {
  it('persiste la ubicación y actualiza lastSeenAt', async () => {
    const { repository, model } = makeRepository()
    const doc = { userId: 'u1' }
    model.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.setLocation('u1', { latitude: -34.6, longitude: -58.4 })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      {
        $set: {
          currentLocation: { latitude: -34.6, longitude: -58.4 },
          lastSeenAt: expect.any(Date),
        },
      },
      { new: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si el rider no existe', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.setLocation('u1', { latitude: 0, longitude: 0 })).resolves.toBeNull()
  })
})

describe('RiderRepository.setStatus', () => {
  it('actualiza únicamente el status', async () => {
    const { repository, model } = makeRepository()
    model.findOneAndUpdate.mockReturnValue(execQuery({ userId: 'u1' }))

    await repository.setStatus('u1', RIDER_STATUS.onTrip)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1' },
      { $set: { status: RIDER_STATUS.onTrip } },
      { new: true },
    )
  })
})
