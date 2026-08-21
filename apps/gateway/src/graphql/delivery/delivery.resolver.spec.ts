import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { OrderStatus } from '../common/order-status.enum'
import { TripStatus } from '../common/trip-status.enum'
import { DeliveryResolver } from './delivery.resolver'

const ctx = {
  authenticated: true,
  userId: 'u1',
  roles: ['rider'],
  branchId: null,
  requestId: 'rid-1',
  authorization: 'Bearer xyz',
} as unknown as GraphQLContext

const rawRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: 'Moto',
  phone: '11223344',
  available: true,
  currentLocation: { latitude: -34.6, longitude: -58.4 },
}

const rawTripOrder = {
  orderId: 'ord-1',
  pickupBranchId: 'b1',
  pickupLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  status: 'ready_for_delivery',
  pickedUpAt: null,
  deliveredAt: null,
}

const rawTripOffer = {
  id: 't1',
  orderCount: 2,
  distanceKm: 5.5,
  estimatedMinutes: 13,
  estimatedEarnings: 1200,
  expiresAt: '2026-01-01T00:01:00.000Z',
}

const rawTrip = {
  id: 't1',
  riderId: 'u1',
  status: 'active',
  orders: [rawTripOrder],
  distanceKm: 5,
  estimatedMinutes: 12,
  estimatedEarnings: 1500,
  earnings: null,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  expiresAt: null,
}

describe('DeliveryResolver — queries', () => {
  const rest = { get: jest.fn() }
  const resolver = new DeliveryResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('riderProfile → GET /v1/riders/me y mapea el rider', async () => {
    rest.get.mockResolvedValue(rawRider)

    const result = await resolver.riderProfile(ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/riders/me', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.id).toBe('r1')
    expect(result.available).toBe(true)
    expect(result.currentLocation).toEqual({ latitude: -34.6, longitude: -58.4 })
  })

  it('tripOffers → GET /v1/trips/offers y mapea data', async () => {
    rest.get.mockResolvedValue({ data: [rawTripOffer] })

    const result = await resolver.tripOffers(ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/trips/offers', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result).toHaveLength(1)
    expect(result[0].orderCount).toBe(2)
  })

  it('trip → GET /v1/trips/{id} y mapea status/order', async () => {
    rest.get.mockResolvedValue(rawTrip)

    const result = await resolver.trip('t1', ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/trips/t1', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.status).toBe(TripStatus.ACTIVE)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0].status).toBe(OrderStatus.READY_FOR_DELIVERY)
  })

  it('myTrips → GET /v1/trips con paginación', async () => {
    rest.get.mockResolvedValue({ data: [rawTrip] })

    const result = await resolver.myTrips({ limit: 5, offset: 10 }, ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/trips', {
      context: expect.objectContaining({ userId: 'u1' }),
      query: { limit: 5, offset: 10 },
    })
    expect(result).toHaveLength(1)
  })

  it('myTrips tolera página ausente', async () => {
    rest.get.mockResolvedValue({ data: [] })

    await resolver.myTrips(null, ctx)

    expect(rest.get).toHaveBeenCalledWith(
      '/v1/trips',
      expect.objectContaining({ query: { limit: undefined, offset: undefined } }),
    )
  })
})

describe('DeliveryResolver — mutations', () => {
  const rest = { patch: jest.fn(), post: jest.fn() }
  const resolver = new DeliveryResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('updateRiderProfile → PATCH /v1/riders/me', async () => {
    rest.patch.mockResolvedValue({ ...rawRider, vehicle: 'Bici' })

    const result = await resolver.updateRiderProfile({ vehicle: 'Bici' }, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/riders/me', {
      body: { vehicle: 'Bici' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.vehicle).toBe('Bici')
  })

  it('setRiderAvailability → PATCH /v1/riders/me/availability', async () => {
    rest.patch.mockResolvedValue({ ...rawRider, available: false })

    const result = await resolver.setRiderAvailability(false, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/riders/me/availability', {
      body: { online: false },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.available).toBe(false)
  })

  it('updateRiderLocation → PATCH /v1/riders/me/location', async () => {
    rest.patch.mockResolvedValue(rawRider)

    await resolver.updateRiderLocation(-34.6, -58.4, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/riders/me/location', {
      body: { lat: -34.6, lng: -58.4 },
      context: expect.objectContaining({ userId: 'u1' }),
    })
  })

  it('acceptTripOffer → POST /v1/trips/offers/{id}/accept', async () => {
    rest.post.mockResolvedValue(rawTrip)

    const result = await resolver.acceptTripOffer('t1', ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/trips/offers/t1/accept', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.status).toBe(TripStatus.ACTIVE)
  })

  it('rejectTripOffer → POST /v1/trips/offers/{id}/reject y devuelve true', async () => {
    rest.post.mockResolvedValue({ ok: true })

    const result = await resolver.rejectTripOffer('t1', ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/trips/offers/t1/reject', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result).toBe(true)
  })

  it('markOrderPickup → POST /v1/trips/{tripId}/orders/{orderId}/pickup', async () => {
    rest.post.mockResolvedValue(rawTrip)

    await resolver.markOrderPickup('t1', 'ord-1', ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/trips/t1/orders/ord-1/pickup', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
  })

  it('markOrderDelivered → POST /v1/trips/{tripId}/orders/{orderId}/deliver', async () => {
    rest.post.mockResolvedValue({ ...rawTrip, status: 'completed' })

    const result = await resolver.markOrderDelivered('t1', 'ord-1', ctx)

    expect(rest.post).toHaveBeenCalledWith('/v1/trips/t1/orders/ord-1/deliver', {
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.status).toBe(TripStatus.COMPLETED)
  })
})
