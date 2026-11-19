import { GraphQLError } from 'graphql'
import { ROLES } from '../../config/constants'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { ROLES_KEY } from '../../security/roles.decorator'
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

const adminCtx = {
  ...ctx,
  userId: 'admin-1',
  roles: ['super_admin'],
} as unknown as GraphQLContext

const rawTariff = {
  id: 'tar-1',
  baseFare: 500,
  perKm: 200,
  perOrder: 300,
  currency: 'ARS',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  active: true,
  createdBy: 'admin-1',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const rawRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: { type: 'moto', marca: 'Honda' },
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

  it('deliveryTariff → GET /v1/tariffs/active con token interno', async () => {
    rest.get.mockResolvedValue(rawTariff)

    const result = await resolver.deliveryTariff(adminCtx)

    expect(rest.get).toHaveBeenCalledWith('/v1/tariffs/active', {
      context: expect.objectContaining({
        userId: 'admin-1',
        internalToken: 'dev-internal-token',
      }),
    })
    expect(result).toMatchObject({ id: 'tar-1', baseFare: 500, active: true })
  })

  it('deliveryTariffs → GET /v1/tariffs con el límite pedido', async () => {
    rest.get.mockResolvedValue([rawTariff])

    const result = await resolver.deliveryTariffs(5, adminCtx)

    expect(rest.get).toHaveBeenCalledWith('/v1/tariffs', {
      context: expect.objectContaining({ internalToken: 'dev-internal-token' }),
      query: { limit: 5 },
    })
    expect(result).toHaveLength(1)
  })

  it('deliveryTariffs usa 20 por defecto al llamar directo', async () => {
    rest.get.mockResolvedValue([])

    await resolver.deliveryTariffs(undefined as unknown as number, adminCtx)

    expect(rest.get).toHaveBeenCalledWith(
      '/v1/tariffs',
      expect.objectContaining({ query: { limit: 20 } }),
    )
  })
})

describe('DeliveryResolver — mutations', () => {
  const rest = { patch: jest.fn(), post: jest.fn() }
  const resolver = new DeliveryResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it('publishDeliveryTariff → POST /v1/tariffs con createdBy del admin autenticado', async () => {
    rest.post.mockResolvedValue({ ...rawTariff, baseFare: 700 })

    const result = await resolver.publishDeliveryTariff(
      { baseFare: 700, perKm: 250, perOrder: 350, currency: 'ARS' },
      adminCtx,
    )

    expect(rest.post).toHaveBeenCalledWith('/v1/tariffs', {
      body: {
        baseFare: 700,
        perKm: 250,
        perOrder: 350,
        currency: 'ARS',
        createdBy: 'admin-1',
      },
      context: expect.objectContaining({ internalToken: 'dev-internal-token' }),
    })
    expect(result.baseFare).toBe(700)
  })

  it('updateRiderProfile → PATCH /v1/riders/me', async () => {
    rest.patch.mockResolvedValue({ ...rawRider, phone: '999' })

    const result = await resolver.updateRiderProfile({ phone: '999' }, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/riders/me', {
      body: { phone: '999' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.phone).toBe('999')
  })

  it('updateRiderVehicle → PATCH /v1/riders/me/vehicle', async () => {
    rest.patch.mockResolvedValue({
      ...rawRider,
      vehicle: { type: 'bici' },
    })

    const result = await resolver.updateRiderVehicle({ type: 'bici' }, ctx)

    expect(rest.patch).toHaveBeenCalledWith('/v1/riders/me/vehicle', {
      body: { type: 'bici' },
      context: expect.objectContaining({ userId: 'u1' }),
    })
    expect(result.vehicle?.type).toBe('bici')
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

describe('DeliveryResolver — propagación exacta de contexto y errores', () => {
  const rest = { get: jest.fn(), post: jest.fn(), patch: jest.fn() }
  const resolver = new DeliveryResolver(rest as unknown as RestClient)

  const expectedContext = {
    authorization: 'Bearer xyz',
    userId: 'u1',
    roles: ['rider'],
    branchId: null,
    requestId: 'rid-1',
  }

  beforeEach(() => jest.clearAllMocks())

  it('riderProfile propaga el contexto de identidad exacto (RQ-GW-05/RQ-SEC-03)', async () => {
    rest.get.mockResolvedValue(rawRider)

    await resolver.riderProfile(ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/riders/me', { context: expectedContext })
  })

  it('trip propaga contexto exacto e id en el path', async () => {
    rest.get.mockResolvedValue(rawTrip)

    await resolver.trip('t1', ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/trips/t1', { context: expectedContext })
  })

  it('myTrips combina contexto exacto y paginación', async () => {
    rest.get.mockResolvedValue({ data: [] })

    await resolver.myTrips({ limit: 5, offset: 10 }, ctx)

    expect(rest.get).toHaveBeenCalledWith('/v1/trips', {
      context: expectedContext,
      query: { limit: 5, offset: 10 },
    })
  })

  type DeliveryOp = {
    name: string
    method: 'get' | 'post' | 'patch'
    invoke: () => Promise<unknown>
  }

  const deliveryOps: DeliveryOp[] = [
    { name: 'riderProfile', method: 'get', invoke: () => resolver.riderProfile(ctx) },
    { name: 'tripOffers', method: 'get', invoke: () => resolver.tripOffers(ctx) },
    { name: 'trip', method: 'get', invoke: () => resolver.trip('t1', ctx) },
    { name: 'myTrips', method: 'get', invoke: () => resolver.myTrips(null, ctx) },
    {
      name: 'updateRiderProfile',
      method: 'patch',
      invoke: () => resolver.updateRiderProfile({ phone: '1' }, ctx),
    },
    {
      name: 'updateRiderVehicle',
      method: 'patch',
      invoke: () => resolver.updateRiderVehicle({ type: 'moto' }, ctx),
    },
    {
      name: 'setRiderAvailability',
      method: 'patch',
      invoke: () => resolver.setRiderAvailability(true, ctx),
    },
    {
      name: 'updateRiderLocation',
      method: 'patch',
      invoke: () => resolver.updateRiderLocation(0, 0, ctx),
    },
    { name: 'acceptTripOffer', method: 'post', invoke: () => resolver.acceptTripOffer('o1', ctx) },
    { name: 'rejectTripOffer', method: 'post', invoke: () => resolver.rejectTripOffer('o1', ctx) },
    {
      name: 'markOrderPickup',
      method: 'post',
      invoke: () => resolver.markOrderPickup('t1', 'ord-1', ctx),
    },
    {
      name: 'markOrderDelivered',
      method: 'post',
      invoke: () => resolver.markOrderDelivered('t1', 'ord-1', ctx),
    },
  ]

  it.each(deliveryOps)(
    '$name propaga el error del servicio tal cual',
    async ({ method, invoke }) => {
      const failure = new Error('delivery service down')
      rest[method].mockRejectedValueOnce(failure)

      await expect(invoke()).rejects.toBe(failure)
    },
  )
})

describe('DeliveryResolver — tarifas y permisos (RQ-DLV-08)', () => {
  const rest = { get: jest.fn(), post: jest.fn() }
  const resolver = new DeliveryResolver(rest as unknown as RestClient)

  beforeEach(() => jest.clearAllMocks())

  it.each([
    ['deliveryTariff', resolver.deliveryTariff],
    ['deliveryTariffs', resolver.deliveryTariffs],
    ['publishDeliveryTariff', resolver.publishDeliveryTariff],
  ] as const)('$0 exige únicamente super_admin', (name, handler) => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler) as string[]

    expect(name).toBeTruthy()
    expect(roles).toEqual([ROLES.superAdmin])
    expect(roles).not.toContain(ROLES.rider)
  })

  it('propaga el conflicto 409 de publicación como error GraphQL', async () => {
    const conflict = new GraphQLError('tarifa en conflicto', {
      extensions: { code: 'TARIFF_CONFLICT', httpStatus: 409 },
    })
    rest.post.mockRejectedValue(conflict)

    await expect(
      resolver.publishDeliveryTariff(
        { baseFare: 1, perKm: 1, perOrder: 1, currency: 'ARS' },
        adminCtx,
      ),
    ).rejects.toBe(conflict)
  })

  it('propaga el 503 de tarifa no disponible como error GraphQL', async () => {
    const unavailable = new GraphQLError('sin tarifa', {
      extensions: { code: 'TARIFF_NOT_AVAILABLE', httpStatus: 503 },
    })
    rest.get.mockRejectedValue(unavailable)

    await expect(resolver.deliveryTariff(adminCtx)).rejects.toBe(unavailable)
  })
})
