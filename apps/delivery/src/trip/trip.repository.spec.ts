import type { Model } from 'mongoose'
import { ORDER_STATUS, TRIP_STATUS } from '../config/constants'
import type { TripDocument } from './trip.model'
import { TripRepository } from './trip.repository'
import type { CreateTripData } from './trip.repository'

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const sortableQuery = <T>(result: T) => {
  const exec = jest.fn().mockResolvedValue(result)
  const sort = jest.fn().mockReturnValue({ exec })
  return { sort, exec }
}

const paginatedQuery = <T>(result: T) => {
  const exec = jest.fn().mockResolvedValue(result)
  const limit = jest.fn().mockReturnValue({ exec })
  const skip = jest.fn().mockReturnValue({ limit })
  const sort = jest.fn().mockReturnValue({ skip })
  return { sort, skip, limit, exec }
}

const makeRepository = () => {
  const model = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  }
  const repository = new TripRepository(model as unknown as Model<TripDocument>)
  return { repository, model }
}

const tripOrder = {
  orderId: 'ord-1',
  pickupBranchId: 'b1',
  pickupLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  status: ORDER_STATUS.readyForDelivery,
  pickedUpAt: null,
  deliveredAt: null,
}

const createData: CreateTripData = {
  riderId: 'u1',
  status: TRIP_STATUS.offered,
  orders: [tripOrder],
  distanceKm: 5,
  estimatedMinutes: 12,
  estimatedEarnings: 1500,
  expiresAt: new Date('2026-01-01T00:01:00.000Z'),
}

describe('TripRepository.create / findById', () => {
  it('crea el viaje con los datos recibidos', async () => {
    const { repository, model } = makeRepository()
    const doc = { id: 't1' }
    model.create.mockResolvedValue(doc)

    const result = await repository.create(createData)

    expect(model.create).toHaveBeenCalledWith(createData)
    expect(result).toBe(doc)
  })

  it('findById busca por _id y devuelve el documento', async () => {
    const { repository, model } = makeRepository()
    const doc = { id: 't1' }
    model.findById.mockReturnValue(execQuery(doc))

    const result = await repository.findById('t1')

    expect(model.findById).toHaveBeenCalledWith('t1')
    expect(result).toBe(doc)
  })

  it('findById devuelve null si no existe', async () => {
    const { repository, model } = makeRepository()
    model.findById.mockReturnValue(execQuery(null))

    await expect(repository.findById('t1')).resolves.toBeNull()
  })
})

describe('TripRepository.findByIdForRider (RQ-SEC-06)', () => {
  it('filtra por _id y riderId (propiedad)', async () => {
    const { repository, model } = makeRepository()
    const doc = { id: 't1' }
    model.findOne.mockReturnValue(execQuery(doc))

    const result = await repository.findByIdForRider('t1', 'u1')

    expect(model.findOne).toHaveBeenCalledWith({ _id: 't1', riderId: 'u1' })
    expect(result).toBe(doc)
  })

  it('devuelve null cuando el viaje es de otro repartidor', async () => {
    const { repository, model } = makeRepository()
    model.findOne.mockReturnValue(execQuery(null))

    await expect(repository.findByIdForRider('t1', 'otro')).resolves.toBeNull()
  })
})

describe('TripRepository.findActiveOfferByRider (RQ-DLV-05)', () => {
  it('filtra ofertas vigentes y ordena por la más antigua', async () => {
    const { repository, model } = makeRepository()
    const now = new Date('2026-01-01T00:00:00.000Z')
    const doc = { id: 't1' }
    const query = sortableQuery(doc)
    model.findOne.mockReturnValue(query)

    const result = await repository.findActiveOfferByRider('u1', now)

    expect(model.findOne).toHaveBeenCalledWith({
      riderId: 'u1',
      status: TRIP_STATUS.offered,
      expiresAt: { $gt: now },
    })
    expect(query.sort).toHaveBeenCalledWith({ createdAt: 1 })
    expect(result).toBe(doc)
  })

  it('devuelve null si no hay oferta vigente', async () => {
    const { repository, model } = makeRepository()
    model.findOne.mockReturnValue(sortableQuery(null))

    await expect(
      repository.findActiveOfferByRider('u1', new Date('2026-01-01T00:00:00.000Z')),
    ).resolves.toBeNull()
  })
})

describe('TripRepository.listByRider (RQ-DLV-10)', () => {
  const cases: Array<{ name: string; limit: number; offset: number }> = [
    { name: 'primera página', limit: 20, offset: 0 },
    { name: 'página intermedia', limit: 10, offset: 20 },
    { name: 'límite máximo', limit: 100, offset: 0 },
  ]

  it.each(cases)('pagina los viajes del rider ($name)', async ({ limit, offset }) => {
    const { repository, model } = makeRepository()
    const data = [{ id: 't1' }]
    const query = paginatedQuery(data)
    model.find.mockReturnValue(query)
    model.countDocuments.mockReturnValue(execQuery(1))

    const result = await repository.listByRider('u1', limit, offset)

    expect(model.find).toHaveBeenCalledWith({ riderId: 'u1' })
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 })
    expect(query.skip).toHaveBeenCalledWith(offset)
    expect(query.limit).toHaveBeenCalledWith(limit)
    expect(model.countDocuments).toHaveBeenCalledWith({ riderId: 'u1' })
    expect(result).toEqual({ data, total: 1 })
  })

  it('devuelve lista vacía y total 0', async () => {
    const { repository, model } = makeRepository()
    model.find.mockReturnValue(paginatedQuery([]))
    model.countDocuments.mockReturnValue(execQuery(0))

    const result = await repository.listByRider('u1', 20, 0)

    expect(result).toEqual({ data: [], total: 0 })
  })
})

describe('TripRepository.save', () => {
  it('persiste el documento (doc.save)', async () => {
    const { repository } = makeRepository()
    const save = jest.fn().mockResolvedValue({ id: 't1' })
    const doc = { save } as unknown as TripDocument

    const result = await repository.save(doc)

    expect(save).toHaveBeenCalled()
    expect(result).toEqual({ id: 't1' })
  })
})
