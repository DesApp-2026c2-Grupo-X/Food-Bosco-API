import { ERROR_CODES, ORDER_STATUS, RIDER_STATUS, TRIP_STATUS } from '../config/constants'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { CommerceClient } from '../config/http/commerce.client'
import { EventBus } from '../config/messaging/event-bus'
import { haversineDistanceKm } from '../config/geo/distance'
import type { PublicDeliveryOrder } from '../delivery-order/delivery-order.model'
import { DeliveryOrderService } from '../delivery-order/delivery-order.service'
import type { PublicRider } from '../rider/rider.model'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import { RiderService } from '../rider/rider.service'
import type { PublicTrip } from '../trip/trip.model'
import { TripService } from '../trip/trip.service'
import { OfferOrchestrator } from './offer.orchestrator'

const rider: PublicRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'J',
  lastName: 'P',
  vehicle: { type: 'moto', brand: 'Honda' },
  phone: '1',
  available: true,
  status: 'free',
  currentLocation: { latitude: 0, longitude: 0 },
  lastSeenAt: new Date().toISOString(),
}

const deliveryOrder: PublicDeliveryOrder = {
  orderId: 'ord-1',
  branchId: 'b1',
  branchLocation: { latitude: 0.001, longitude: 0 },
  deliveryAddress: { text: 'Av 123', latitude: 0.002, longitude: 0 },
  status: 'ready',
}

const trip: PublicTrip = {
  id: 't1',
  riderId: 'u1',
  status: 'offered',
  orders: [
    {
      orderId: 'ord-1',
      pickupBranchId: 'b1',
      pickupLocation: { latitude: 0.001, longitude: 0 },
      deliveryAddress: { text: 'Av 123', latitude: 0.002, longitude: 0 },
      status: ORDER_STATUS.readyForDelivery,
      pickedUpAt: null,
      deliveredAt: null,
    },
  ],
  distanceKm: 5,
  estimatedMinutes: 12,
  estimatedEarnings: 1500,
  earnings: null,
  startedAt: null,
  completedAt: null,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: '2026-01-01T00:00:00.000Z',
}

const makeOrchestrator = () => {
  const riderOrchestrator = {
    getProfile: jest.fn(),
    setStatus: jest.fn(),
  }
  const tripService = {
    createOffered: jest.fn(),
    findById: jest.fn(),
    findActiveOffer: jest.fn(),
    markActive: jest.fn(),
    markCancelled: jest.fn(),
    markOrderPickedUp: jest.fn(),
    markOrderDelivered: jest.fn(),
  }
  const deliveryOrderService = {
    claimableForRider: jest.fn(),
    reserve: jest.fn().mockImplementation((orderIds: string[]) => Promise.resolve(orderIds.length)),
    markAssigned: jest.fn(),
    releaseByTrip: jest.fn(),
    releaseExpired: jest.fn(),
  }
  const riderService = { listAvailable: jest.fn().mockResolvedValue([]) }
  const commerceClient = { patchOrderStatus: jest.fn() }
  const eventBus = { publish: jest.fn() }

  const orchestrator = new OfferOrchestrator(
    riderOrchestrator as unknown as RiderOrchestrator,
    riderService as unknown as RiderService,
    tripService as unknown as TripService,
    deliveryOrderService as unknown as DeliveryOrderService,
    commerceClient as unknown as CommerceClient,
    eventBus as unknown as EventBus,
  )

  return {
    orchestrator,
    riderOrchestrator,
    riderService,
    tripService,
    deliveryOrderService,
    commerceClient,
    eventBus,
  }
}

describe('OfferOrchestrator.listOffers (RQ-DLV-01/02/03)', () => {
  it('rechaza si el repartidor está offline', async () => {
    const { orchestrator, riderOrchestrator } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue({ ...rider, available: false })

    await expect(orchestrator.listOffers('u1')).rejects.toMatchObject({
      code: ERROR_CODES.riderOffline,
    })
  })

  it('rechaza si el repartidor no se reportó dentro del umbral (stale)', async () => {
    const { orchestrator, riderOrchestrator } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue({
      ...rider,
      lastSeenAt: new Date(Date.now() - env.rider.staleAfterMs - 1_000).toISOString(),
    })

    await expect(orchestrator.listOffers('u1')).rejects.toMatchObject({
      code: ERROR_CODES.riderOffline,
    })
  })

  it('rechaza si no compartió ubicación', async () => {
    const { orchestrator, riderOrchestrator } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue({ ...rider, currentLocation: null })

    await expect(orchestrator.listOffers('u1')).rejects.toMatchObject({
      code: ERROR_CODES.locationRequired,
    })
  })

  it('devuelve lista vacía si no hay órdenes disponibles', async () => {
    const { orchestrator, riderOrchestrator, deliveryOrderService } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([])

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
  })

  it('reutiliza la oferta vigente del repartidor en lugar de crear una nueva', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    tripService.findActiveOffer.mockResolvedValue(trip)

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({
      data: [
        {
          id: 't1',
          orderCount: 1,
          distanceKm: 5,
          estimatedMinutes: 12,
          estimatedEarnings: 1500,
          expiresAt: trip.expiresAt,
        },
      ],
    })
    expect(tripService.createOffered).not.toHaveBeenCalled()
    expect(deliveryOrderService.claimableForRider).not.toHaveBeenCalled()
    expect(deliveryOrderService.reserve).not.toHaveBeenCalled()
  })

  it('crea una nueva oferta cuando la vigente venció', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    tripService.findActiveOffer.mockResolvedValue(null)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([deliveryOrder])
    tripService.createOffered.mockResolvedValue(trip)

    const result = await orchestrator.listOffers('u1')

    expect(tripService.createOffered).toHaveBeenCalledWith(
      expect.objectContaining({ riderId: 'u1' }),
    )
    expect(result.data).toHaveLength(1)
  })

  it('hace rollback si la reserva pierde la carrera contra otro rider', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    tripService.findActiveOffer.mockResolvedValue(null)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([deliveryOrder])
    tripService.createOffered.mockResolvedValue(trip)
    deliveryOrderService.reserve.mockResolvedValue(0)

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(deliveryOrderService.releaseByTrip).toHaveBeenCalledWith(
      't1',
      expect.any(Date),
      expect.any(Object),
    )
    expect(tripService.markCancelled).toHaveBeenCalledWith('t1')
  })

  it('no ofrece si no es el turno del rider (rotación estricta)', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    tripService.findActiveOffer.mockResolvedValue(null)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([])

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(tripService.createOffered).not.toHaveBeenCalled()
    expect(deliveryOrderService.claimableForRider).toHaveBeenCalledWith(
      'u1',
      expect.any(Date),
      expect.any(Object),
    )
  })

  it('arma una oferta, crea el viaje y reserva las órdenes', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([deliveryOrder])
    tripService.createOffered.mockResolvedValue(trip)

    const result = await orchestrator.listOffers('u1')

    expect(tripService.createOffered).toHaveBeenCalledWith(
      expect.objectContaining({
        riderId: 'u1',
        orders: expect.arrayContaining([
          expect.objectContaining({ orderId: 'ord-1', pickupBranchId: 'b1' }),
        ]),
      }),
    )
    expect(deliveryOrderService.reserve).toHaveBeenCalledWith(['ord-1'], 't1', expect.any(Date))
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 't1',
        orderCount: 1,
        distanceKm: 5,
        estimatedMinutes: 12,
        estimatedEarnings: 1500,
      }),
    )
  })

  it('calcula distancia, minutos y ganancia con las fórmulas de oferta', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([deliveryOrder])
    tripService.createOffered.mockImplementation(async (input) => ({
      ...trip,
      id: 't1',
      distanceKm: input.distanceKm,
      estimatedMinutes: input.estimatedMinutes,
      estimatedEarnings: input.estimatedEarnings,
    }))

    const riderLoc = { latitude: 0, longitude: 0 }
    const branchLoc = deliveryOrder.branchLocation
    const deliveryLoc = deliveryOrder.deliveryAddress
    const routeKm =
      haversineDistanceKm(riderLoc, branchLoc) + haversineDistanceKm(branchLoc, deliveryLoc)
    const expectedDistance = Math.round(routeKm * 100) / 100
    const expectedMinutes = Math.round((expectedDistance / env.offer.avgSpeedKmh) * 60)
    const expectedEarnings = Math.round(
      env.offer.earningsBase +
        env.offer.earningsPerKm * expectedDistance +
        env.offer.earningsPerOrder,
    )

    await orchestrator.listOffers('u1')

    expect(tripService.createOffered).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceKm: expectedDistance,
        estimatedMinutes: expectedMinutes,
        estimatedEarnings: expectedEarnings,
      }),
    )
  })

  it('no ofrece viajes a un repartidor que ya tiene un viaje en curso', async () => {
    const { orchestrator, riderOrchestrator, tripService } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue({
      ...rider,
      status: RIDER_STATUS.onTrip,
    })

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(tripService.createOffered).not.toHaveBeenCalled()
  })

  it('cancela las ofertas vencidas al buscar nuevas', async () => {
    const { orchestrator, riderOrchestrator, deliveryOrderService, tripService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue(['stale-1'])
    deliveryOrderService.claimableForRider.mockResolvedValue([])
    tripService.findById.mockResolvedValue({ ...trip, id: 'stale-1', status: 'offered' })

    await orchestrator.listOffers('u1')

    expect(tripService.markCancelled).toHaveBeenCalledWith('stale-1')
  })

  it('devuelve vacío si ninguna orden está dentro de la distancia máxima', async () => {
    const { orchestrator, riderOrchestrator, deliveryOrderService, tripService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([
      {
        ...deliveryOrder,
        branchLocation: { latitude: 1, longitude: 1 },
        deliveryAddress: { text: 'Lejos', latitude: 1, longitude: 1 },
      },
    ])

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(tripService.createOffered).not.toHaveBeenCalled()
  })
})

describe('OfferOrchestrator.acceptOffer (RQ-DLV-05/06)', () => {
  it('acepta la oferta, asigna órdenes y publica trip.accepted', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService, eventBus } =
      makeOrchestrator()
    tripService.findById.mockResolvedValue(trip)
    tripService.markActive.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    const result = await orchestrator.acceptOffer('u1', 't1')

    expect(tripService.markActive).toHaveBeenCalledWith('t1')
    expect(deliveryOrderService.markAssigned).toHaveBeenCalledWith(['ord-1'], 't1')
    expect(riderOrchestrator.setStatus).toHaveBeenCalledWith('u1', RIDER_STATUS.onTrip)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'trip.accepted', tripId: 't1', orderIds: ['ord-1'] }),
    )
    expect(result.status).toBe(TRIP_STATUS.active)
  })

  it('rechaza una oferta inexistente', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue(null)

    await expect(orchestrator.acceptOffer('u1', 't1')).rejects.toMatchObject({
      code: ERROR_CODES.offerNotFound,
    })
  })

  it('rechaza una oferta vencida', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, expiresAt: '2020-01-01T00:00:00.000Z' })

    await expect(orchestrator.acceptOffer('u1', 't1')).rejects.toMatchObject({
      code: ERROR_CODES.offerExpired,
    })
  })

  it('rechaza aceptar una oferta de otro repartidor', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, riderId: 'rider-otro' })

    await expect(orchestrator.acceptOffer('u1', 't1')).rejects.toMatchObject({
      code: ERROR_CODES.offerNotFound,
    })
  })

  it('rechaza aceptar una oferta que ya no está en estado offered', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    await expect(orchestrator.acceptOffer('u1', 't1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
  })
})

describe('OfferOrchestrator.rejectOffer (RQ-DLV-05)', () => {
  it('cancela la oferta y libera las órdenes', async () => {
    const { orchestrator, tripService, deliveryOrderService } = makeOrchestrator()
    tripService.findById.mockResolvedValue(trip)

    await orchestrator.rejectOffer('u1', 't1')

    expect(tripService.markCancelled).toHaveBeenCalledWith('t1')
    expect(deliveryOrderService.releaseByTrip).toHaveBeenCalledWith(
      't1',
      expect.any(Date),
      expect.any(Object),
    )
  })

  it('rechaza una oferta de otro repartidor', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, riderId: 'rider-otro' })

    await expect(orchestrator.rejectOffer('u1', 't1')).rejects.toMatchObject({
      code: ERROR_CODES.offerNotFound,
    })
  })
})

describe('OfferOrchestrator.markPickup (RQ-DLV-07)', () => {
  it('transiciona la orden a on_the_way vía Commerce y actualiza el viaje', async () => {
    const { orchestrator, tripService, commerceClient } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })
    commerceClient.patchOrderStatus.mockResolvedValue(undefined)
    tripService.markOrderPickedUp.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    await orchestrator.markPickup('u1', 't1', 'ord-1')

    expect(commerceClient.patchOrderStatus).toHaveBeenCalledWith('ord-1', ORDER_STATUS.onTheWay)
    expect(tripService.markOrderPickedUp).toHaveBeenCalledWith('t1', 'ord-1')
  })

  it('rechaza si el viaje no pertenece al repartidor', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, riderId: 'otro' })

    await expect(orchestrator.markPickup('u1', 't1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.tripNotFound,
    })
  })

  it('rechaza si la orden no pertenece al viaje (sin llamar a Commerce)', async () => {
    const { orchestrator, tripService, commerceClient } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    await expect(orchestrator.markPickup('u1', 't1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
    expect(commerceClient.patchOrderStatus).not.toHaveBeenCalled()
  })

  it('rechaza si el viaje no está en curso', async () => {
    const { orchestrator, tripService, commerceClient } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.offered })

    await expect(orchestrator.markPickup('u1', 't1', 'ord-1')).rejects.toMatchObject({
      code: ERROR_CODES.invalidTripStatus,
    })
    expect(commerceClient.patchOrderStatus).not.toHaveBeenCalled()
  })
})

describe('OfferOrchestrator.markDeliver (RQ-DLV-07/08, RQ-DLV-12)', () => {
  it('al entregar la última orden completa el viaje y publica trip.completed', async () => {
    const { orchestrator, tripService, commerceClient, riderOrchestrator, eventBus } =
      makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })
    commerceClient.patchOrderStatus.mockResolvedValue(undefined)
    tripService.markOrderDelivered.mockResolvedValue({
      ...trip,
      status: TRIP_STATUS.completed,
      earnings: 1500,
    })

    await orchestrator.markDeliver('u1', 't1', 'ord-1')

    expect(commerceClient.patchOrderStatus).toHaveBeenCalledWith('ord-1', ORDER_STATUS.delivered)
    expect(riderOrchestrator.setStatus).toHaveBeenCalledWith('u1', RIDER_STATUS.free)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'trip.completed', tripId: 't1' }),
    )
  })

  it('no libera al rider si el viaje sigue activo', async () => {
    const { orchestrator, tripService, commerceClient, riderOrchestrator, eventBus } =
      makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })
    commerceClient.patchOrderStatus.mockResolvedValue(undefined)
    tripService.markOrderDelivered.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    await orchestrator.markDeliver('u1', 't1', 'ord-1')

    expect(riderOrchestrator.setStatus).not.toHaveBeenCalled()
    expect(eventBus.publish).not.toHaveBeenCalled()
  })

  it('rechaza si la orden no pertenece al viaje (sin llamar a Commerce)', async () => {
    const { orchestrator, tripService, commerceClient } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    await expect(orchestrator.markDeliver('u1', 't1', 'ord-999')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotInTrip,
    })
    expect(commerceClient.patchOrderStatus).not.toHaveBeenCalled()
  })
})

const captureDomainError = async (promise: Promise<unknown>): Promise<DomainException> => {
  try {
    await promise
  } catch (error) {
    return error as DomainException
  }
  throw new Error('Se esperaba un error de dominio y no hubo ninguno')
}

interface CreateOfferedInput {
  riderId: string
  orders: Array<{ orderId: string; pickupBranchId: string }>
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  expiresAt: Date
}

const orderAt = (orderId: string, branchLat: number): PublicDeliveryOrder => ({
  orderId,
  branchId: `b-${orderId}`,
  branchLocation: { latitude: branchLat, longitude: 0 },
  deliveryAddress: { text: `addr-${orderId}`, latitude: branchLat + 0.0005, longitude: 0 },
  status: 'ready',
})

const routeKmOf = (orders: PublicDeliveryOrder[]): number =>
  orders.reduce(
    (acc, order) => {
      const toPickup = haversineDistanceKm(acc.previous, order.branchLocation)
      const pickupToDelivery = haversineDistanceKm(order.branchLocation, order.deliveryAddress)
      return { total: acc.total + toPickup + pickupToDelivery, previous: order.deliveryAddress }
    },
    { total: 0, previous: { latitude: 0, longitude: 0 } },
  ).total

const firstCallInput = (tripService: { createOffered: jest.Mock }): CreateOfferedInput =>
  tripService.createOffered.mock.calls[0][0] as CreateOfferedInput

describe('OfferOrchestrator.listOffers: agrupación y límites (RQ-DLV-03/04)', () => {
  const readyTrip = (input: CreateOfferedInput): PublicTrip => ({
    ...trip,
    riderId: input.riderId,
    orders: input.orders.map((order) => ({
      orderId: order.orderId,
      pickupBranchId: order.pickupBranchId,
      pickupLocation: { latitude: 0, longitude: 0 },
      deliveryAddress: { text: 'Av', latitude: 0, longitude: 0 },
      status: ORDER_STATUS.readyForDelivery,
      pickedUpAt: null,
      deliveredAt: null,
    })),
    distanceKm: input.distanceKm,
    estimatedMinutes: input.estimatedMinutes,
    estimatedEarnings: input.estimatedEarnings,
    expiresAt: input.expiresAt.toISOString(),
  })

  it('agrupa como máximo maxOrdersPerTrip órdenes, priorizando las más cercanas', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([
      orderAt('C', 0.003),
      orderAt('A', 0.001),
      orderAt('D', 0.004),
      orderAt('B', 0.002),
    ])
    tripService.createOffered.mockImplementation(async (input: CreateOfferedInput) =>
      readyTrip(input),
    )

    await orchestrator.listOffers('u1')

    const input = firstCallInput(tripService)
    expect(input.orders.map((order) => order.orderId)).toEqual(['A', 'B', 'C'])
    expect(input.orders).toHaveLength(env.offer.maxOrdersPerTrip)
  })

  it('calcula distancia, minutos y ganancia agregando todas las órdenes seleccionadas', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([
      orderAt('A', 0.001),
      orderAt('B', 0.002),
      orderAt('C', 0.003),
    ])
    tripService.createOffered.mockImplementation(async (input: CreateOfferedInput) =>
      readyTrip(input),
    )

    await orchestrator.listOffers('u1')

    const selected = [orderAt('A', 0.001), orderAt('B', 0.002), orderAt('C', 0.003)]
    const routeKm = routeKmOf(selected)
    const expectedDistance = Math.round(routeKm * 100) / 100
    const expectedMinutes = Math.round((expectedDistance / env.offer.avgSpeedKmh) * 60)
    const expectedEarnings = Math.round(
      env.offer.earningsBase +
        env.offer.earningsPerKm * expectedDistance +
        env.offer.earningsPerOrder * selected.length,
    )

    expect(tripService.createOffered).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceKm: expectedDistance,
        estimatedMinutes: expectedMinutes,
        estimatedEarnings: expectedEarnings,
      }),
    )
    expect(firstCallInput(tripService).orders).toHaveLength(3)
  })

  it.each([
    { name: 'justo dentro del máximo (~7.9 km)', branchLat: 0.071, offered: true },
    { name: 'justo fuera del máximo (~8.1 km)', branchLat: 0.073, offered: false },
  ])('$name → ofrece=$offered', async ({ branchLat, offered }) => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([orderAt('A', branchLat)])
    tripService.createOffered.mockImplementation(async (input: CreateOfferedInput) =>
      readyTrip(input),
    )

    const result = await orchestrator.listOffers('u1')

    expect(result.data).toHaveLength(offered ? 1 : 0)
    if (offered) {
      expect(tripService.createOffered).toHaveBeenCalled()
    } else {
      expect(tripService.createOffered).not.toHaveBeenCalled()
    }
  })

  it('devuelve vacío y no reserva nada cuando el pool de órdenes está vacío (0 órdenes)', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([])

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(tripService.createOffered).not.toHaveBeenCalled()
    expect(deliveryOrderService.reserve).not.toHaveBeenCalled()
  })

  it('hace rollback si reserva menos órdenes que las ofrecidas (carrera parcial)', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.claimableForRider.mockResolvedValue([
      orderAt('A', 0.001),
      orderAt('B', 0.002),
    ])
    tripService.createOffered.mockImplementation(async (input: CreateOfferedInput) =>
      readyTrip(input),
    )
    deliveryOrderService.reserve.mockResolvedValue(1)

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
    expect(deliveryOrderService.releaseByTrip).toHaveBeenCalledWith(
      trip.id,
      expect.any(Date),
      expect.any(Object),
    )
    expect(tripService.markCancelled).toHaveBeenCalledWith(trip.id)
  })

  it.each([
    { name: 'no encuentra el viaje vencido', found: null, status: 'offered', cancelled: false },
    {
      name: 'el viaje vencido ya no está offered',
      found: true,
      status: 'active',
      cancelled: false,
    },
    { name: 'el viaje vencido sigue offered', found: true, status: 'offered', cancelled: true },
  ])('al expirar ofertas: $name → cancela=$cancelled', async ({ found, status, cancelled }) => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue(['stale-1'])
    deliveryOrderService.claimableForRider.mockResolvedValue([])
    tripService.findById.mockResolvedValue(
      found ? { ...trip, id: 'stale-1', status: status as PublicTrip['status'] } : null,
    )

    await orchestrator.listOffers('u1')

    if (cancelled) {
      expect(tripService.markCancelled).toHaveBeenCalledWith('stale-1')
    } else {
      expect(tripService.markCancelled).not.toHaveBeenCalled()
    }
  })
})

describe('OfferOrchestrator.acceptOffer: idempotencia/replay (RQ-DLV-05/06)', () => {
  it('una oferta ya aceptada no puede volver a aceptarse (replay)', async () => {
    const { orchestrator, tripService, deliveryOrderService, riderOrchestrator, eventBus } =
      makeOrchestrator()
    let stored: PublicTrip = { ...trip, expiresAt: null }
    tripService.findById.mockImplementation(async () => stored)
    tripService.markActive.mockImplementation(async () => {
      stored = { ...stored, status: TRIP_STATUS.active }
      return stored
    })

    const first = await orchestrator.acceptOffer('u1', 't1')
    expect(first.status).toBe(TRIP_STATUS.active)

    const error = await captureDomainError(orchestrator.acceptOffer('u1', 't1'))

    expect(error.code).toBe(ERROR_CODES.invalidTripStatus)
    expect(error.message).toBe('La oferta ya no está disponible')
    expect(error.getStatus()).toBe(409)
    expect(deliveryOrderService.markAssigned).toHaveBeenCalledTimes(1)
    expect(riderOrchestrator.setStatus).toHaveBeenCalledTimes(1)
    expect(eventBus.publish).toHaveBeenCalledTimes(1)
  })

  it('rechaza aceptar una oferta inexistente con código, mensaje y status', async () => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue(null)

    const error = await captureDomainError(orchestrator.acceptOffer('u1', 'nope'))

    expect(error.code).toBe(ERROR_CODES.offerNotFound)
    expect(error.message).toBe('Oferta no encontrada')
    expect(error.getStatus()).toBe(404)
  })
})

describe('OfferOrchestrator: errores de dominio (código + mensaje + status)', () => {
  it.each([
    {
      name: 'repartidor offline',
      profile: { ...rider, available: false },
      code: ERROR_CODES.riderOffline,
      message: 'El repartidor está offline',
      status: 409,
    },
    {
      name: 'repartidor sin ubicación',
      profile: { ...rider, currentLocation: null },
      code: ERROR_CODES.locationRequired,
      message: 'Comparte tu ubicación para recibir viajes',
      status: 409,
    },
    {
      name: 'repartidor stale',
      profile: {
        ...rider,
        lastSeenAt: new Date(Date.now() - env.rider.staleAfterMs - 1).toISOString(),
      },
      code: ERROR_CODES.riderOffline,
      message: 'El repartidor está offline',
      status: 409,
    },
  ])('listOffers rechaza $name', async ({ profile, code, message, status }) => {
    const { orchestrator, riderOrchestrator } = makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(profile)

    const error = await captureDomainError(orchestrator.listOffers('u1'))

    expect(error.code).toBe(code)
    expect(error.message).toBe(message)
    expect(error.getStatus()).toBe(status)
  })

  it.each([
    {
      name: 'oferta vencida',
      trip: { ...trip, expiresAt: '2020-01-01T00:00:00.000Z' },
      code: ERROR_CODES.offerExpired,
      message: 'La oferta venció',
      status: 409,
    },
    {
      name: 'oferta de otro repartidor',
      trip: { ...trip, riderId: 'otro' },
      code: ERROR_CODES.offerNotFound,
      message: 'Oferta no encontrada',
      status: 404,
    },
    {
      name: 'oferta ya no disponible',
      trip: { ...trip, status: TRIP_STATUS.active },
      code: ERROR_CODES.invalidTripStatus,
      message: 'La oferta ya no está disponible',
      status: 409,
    },
  ])('acceptOffer rechaza $name', async ({ trip: candidate, code, message, status }) => {
    const { orchestrator, tripService } = makeOrchestrator()
    tripService.findById.mockResolvedValue(candidate)

    const error = await captureDomainError(orchestrator.acceptOffer('u1', 't1'))

    expect(error.code).toBe(code)
    expect(error.message).toBe(message)
    expect(error.getStatus()).toBe(status)
  })

  it.each([
    {
      name: 'viaje de otro repartidor',
      trip: { ...trip, status: TRIP_STATUS.active, riderId: 'otro' },
      code: ERROR_CODES.tripNotFound,
      message: 'Viaje no encontrado',
      status: 404,
    },
    {
      name: 'viaje no activo',
      trip: { ...trip, status: TRIP_STATUS.offered },
      code: ERROR_CODES.invalidTripStatus,
      message: 'El viaje no está en curso',
      status: 409,
    },
  ])(
    'markPickup rechaza $name sin llamar a Commerce',
    async ({ trip: candidate, code, message, status }) => {
      const { orchestrator, tripService, commerceClient } = makeOrchestrator()
      tripService.findById.mockResolvedValue(candidate)

      const error = await captureDomainError(orchestrator.markPickup('u1', 't1', 'ord-1'))

      expect(error.code).toBe(code)
      expect(error.message).toBe(message)
      expect(error.getStatus()).toBe(status)
      expect(commerceClient.patchOrderStatus).not.toHaveBeenCalled()
    },
  )

  it('markDeliver rechaza una orden que no pertenece al viaje', async () => {
    const { orchestrator, tripService, commerceClient } = makeOrchestrator()
    tripService.findById.mockResolvedValue({ ...trip, status: TRIP_STATUS.active })

    const error = await captureDomainError(orchestrator.markDeliver('u1', 't1', 'ord-999'))

    expect(error.code).toBe(ERROR_CODES.orderNotInTrip)
    expect(error.message).toBe('La orden no pertenece al viaje')
    expect(error.getStatus()).toBe(404)
    expect(commerceClient.patchOrderStatus).not.toHaveBeenCalled()
  })
})
