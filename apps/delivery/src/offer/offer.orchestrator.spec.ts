import { ERROR_CODES, ORDER_STATUS, RIDER_STATUS, TRIP_STATUS } from '../config/constants'
import { env } from '../config/env'
import { CommerceClient } from '../config/http/commerce.client'
import { EventBus } from '../config/messaging/event-bus'
import { haversineDistanceKm } from '../config/geo/distance'
import type { PublicDeliveryOrder } from '../delivery-order/delivery-order.model'
import { DeliveryOrderService } from '../delivery-order/delivery-order.service'
import type { PublicRider } from '../rider/rider.model'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import type { PublicTrip } from '../trip/trip.model'
import { TripService } from '../trip/trip.service'
import { OfferOrchestrator } from './offer.orchestrator'

const rider: PublicRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'J',
  lastName: 'P',
  vehicle: 'Moto',
  phone: '1',
  available: true,
  status: 'free',
  currentLocation: { latitude: 0, longitude: 0 },
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
    markActive: jest.fn(),
    markCancelled: jest.fn(),
    markOrderPickedUp: jest.fn(),
    markOrderDelivered: jest.fn(),
  }
  const deliveryOrderService = {
    listAvailable: jest.fn(),
    reserve: jest.fn(),
    markAssigned: jest.fn(),
    release: jest.fn(),
    releaseExpired: jest.fn(),
  }
  const commerceClient = { patchOrderStatus: jest.fn() }
  const eventBus = { publish: jest.fn() }

  const orchestrator = new OfferOrchestrator(
    riderOrchestrator as unknown as RiderOrchestrator,
    tripService as unknown as TripService,
    deliveryOrderService as unknown as DeliveryOrderService,
    commerceClient as unknown as CommerceClient,
    eventBus as unknown as EventBus,
  )

  return {
    orchestrator,
    riderOrchestrator,
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
    deliveryOrderService.listAvailable.mockResolvedValue([])

    const result = await orchestrator.listOffers('u1')

    expect(result).toEqual({ data: [] })
  })

  it('arma una oferta, crea el viaje y reserva las órdenes', async () => {
    const { orchestrator, riderOrchestrator, tripService, deliveryOrderService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.listAvailable.mockResolvedValue([deliveryOrder])
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
    deliveryOrderService.listAvailable.mockResolvedValue([deliveryOrder])
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
    deliveryOrderService.listAvailable.mockResolvedValue([])
    tripService.findById.mockResolvedValue({ ...trip, id: 'stale-1', status: 'offered' })

    await orchestrator.listOffers('u1')

    expect(tripService.markCancelled).toHaveBeenCalledWith('stale-1')
  })

  it('devuelve vacío si ninguna orden está dentro de la distancia máxima', async () => {
    const { orchestrator, riderOrchestrator, deliveryOrderService, tripService } =
      makeOrchestrator()
    riderOrchestrator.getProfile.mockResolvedValue(rider)
    deliveryOrderService.releaseExpired.mockResolvedValue([])
    deliveryOrderService.listAvailable.mockResolvedValue([
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
    expect(deliveryOrderService.markAssigned).toHaveBeenCalledWith(['ord-1'])
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
    expect(deliveryOrderService.release).toHaveBeenCalledWith('t1')
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
