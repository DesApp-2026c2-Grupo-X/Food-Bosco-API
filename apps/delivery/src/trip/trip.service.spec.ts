import { ERROR_CODES } from '../config/constants'
import { Trip, TripDocument, TripOrder } from './trip.model'
import { TripRepository } from './trip.repository'
import { TripService } from './trip.service'

const buildOrder = (overrides: Partial<TripOrder> = {}): TripOrder => ({
  orderId: 'ord-1',
  pickupBranchId: 'b1',
  pickupLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  status: 'ready_for_delivery',
  pickedUpAt: null,
  deliveredAt: null,
  ...overrides,
})

const buildDoc = (overrides: Partial<Trip> = {}): TripDocument =>
  ({
    _id: { toString: () => 't1' },
    riderId: 'u1',
    status: 'offered',
    orders: [buildOrder()],
    distanceKm: 5,
    estimatedMinutes: 12,
    estimatedEarnings: 1500,
    earnings: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date('2026-01-01T00:01:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as TripDocument

const makeService = () => {
  const repository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdForRider: jest.fn(),
    listByRider: jest.fn(),
    save: jest.fn((doc: TripDocument) => Promise.resolve(doc)),
  }
  const service = new TripService(repository as unknown as TripRepository)
  return { service, repository }
}

describe('TripService.markActive (RQ-DLV-06)', () => {
  it('transiciona offered → active y registra startedAt', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc())

    const result = await service.markActive('t1')

    expect(result.status).toBe('active')
    expect(result.startedAt).not.toBeNull()
    expect(result.expiresAt).toBeNull()
    expect(repository.save).toHaveBeenCalled()
  })

  it.each(['active', 'completed', 'cancelled'])(
    'rechaza activar un viaje en estado %s',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markActive('t1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.markCancelled', () => {
  it.each(['offered', 'active'])('permite cancelar desde %s', async (status) => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

    const result = await service.markCancelled('t1')

    expect(result.status).toBe('cancelled')
  })

  it.each(['completed', 'cancelled'])('rechaza cancelar un viaje en %s', async (status) => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

    await expect(service.markCancelled('t1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })
})

describe('TripService.markOrderPickedUp (RQ-DLV-07)', () => {
  it('marca el retiro: ready_for_delivery → on_the_way', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    const result = await service.markOrderPickedUp('t1', 'ord-1')

    expect(result.orders[0].status).toBe('on_the_way')
    expect(result.orders[0].pickedUpAt).not.toBeNull()
  })

  it('rechaza retirar dos veces la misma orden', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    await expect(service.markOrderPickedUp('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })

  it('rechaza una orden que no pertenece al viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    await expect(service.markOrderPickedUp('t1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
  })

  it.each(['offered', 'completed', 'cancelled'])(
    'rechaza si el viaje no está en curso (estado %s)',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markOrderPickedUp('t1', 'ord-1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.markOrderDelivered (RQ-DLV-07/08)', () => {
  it('marca la entrega: on_the_way → delivered y completa el viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    const result = await service.markOrderDelivered('t1', 'ord-1')

    expect(result.status).toBe('completed')
    expect(result.orders[0].status).toBe('delivered')
    expect(result.orders[0].deliveredAt).not.toBeNull()
    expect(result.earnings).toBe(1500)
    expect(result.completedAt).not.toBeNull()
  })

  it('no completa el viaje si quedan órdenes pendientes', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({
        status: 'active',
        orders: [
          buildOrder({ status: 'on_the_way' }),
          buildOrder({ orderId: 'ord-2', status: 'on_the_way' }),
        ],
      }),
    )

    const result = await service.markOrderDelivered('t1', 'ord-1')

    expect(result.status).toBe('active')
    expect(result.earnings).toBeNull()
    expect(result.orders[1].status).toBe('on_the_way')
  })

  it('rechaza entregar una orden que no fue retirada', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(buildDoc({ status: 'active' }))

    await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })

  it('rechaza una orden que no pertenece al viaje', async () => {
    const { service, repository } = makeService()
    repository.findById.mockResolvedValue(
      buildDoc({ status: 'active', orders: [buildOrder({ status: 'on_the_way' })] }),
    )

    await expect(service.markOrderDelivered('t1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
  })

  it.each(['offered', 'completed', 'cancelled'])(
    'rechaza si el viaje no está en curso (estado %s)',
    async (status) => {
      const { service, repository } = makeService()
      repository.findById.mockResolvedValue(buildDoc({ status: status as Trip['status'] }))

      await expect(service.markOrderDelivered('t1', 'ord-1')).rejects.toMatchObject({
        code: ERROR_CODES.invalidTripStatus,
      })
    },
  )
})

describe('TripService.findByIdForRider (RQ-SEC-06)', () => {
  it('solo devuelve viajes del repartidor', async () => {
    const { service, repository } = makeService()
    repository.findByIdForRider.mockResolvedValue(null)

    await expect(service.findByIdForRider('t1', 'u1')).resolves.toBeNull()
    expect(repository.findByIdForRider).toHaveBeenCalledWith('t1', 'u1')
  })
})

describe('TripService.listByRider / createOffered', () => {
  it('lista los viajes con meta de paginación', async () => {
    const { service, repository } = makeService()
    repository.listByRider.mockResolvedValue({
      data: [buildDoc({ status: 'completed' })],
      total: 1,
    })

    const result = await service.listByRider('u1', 20, 0)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].status).toBe('completed')
    expect(result.meta).toEqual({ total: 1, limit: 20, offset: 0 })
  })

  it('crea un viaje en estado offered', async () => {
    const { service, repository } = makeService()
    repository.create.mockResolvedValue(buildDoc())

    const result = await service.createOffered({
      riderId: 'u1',
      orders: [buildOrder()],
      distanceKm: 5,
      estimatedMinutes: 12,
      estimatedEarnings: 1500,
      expiresAt: new Date('2026-01-01T00:01:00.000Z'),
    })

    expect(result.status).toBe('offered')
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ riderId: 'u1', status: 'offered' }),
    )
  })
})
