import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { ERROR_CODES, ORDER_STATUS, RIDER_STATUS, TRIP_STATUS } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { env } from '../config/env'
import { CommerceClient } from '../config/http/commerce.client'
import { EventBus } from '../config/messaging/event-bus'
import { TRIP_ACCEPTED_EVENT, TRIP_COMPLETED_EVENT } from '../config/messaging/events'
import type { TripAcceptedEvent, TripCompletedEvent } from '../config/messaging/events'
import type { PublicDeliveryOrder } from '../delivery-order/delivery-order.model'
import { DeliveryOrderService } from '../delivery-order/delivery-order.service'
import type { PublicRider } from '../rider/rider.model'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import type { PublicTrip, TripOrder } from '../trip/trip.model'
import { TripService } from '../trip/trip.service'
import { estimateMinutes, haversineDistanceKm } from '../config/geo/distance'

export interface TripOfferProjection {
  id: string
  orderCount: number
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  expiresAt: string
}

export interface OfferListResponse {
  data: TripOfferProjection[]
}

@Injectable()
export class OfferOrchestrator {
  constructor(
    private readonly riderOrchestrator: RiderOrchestrator,
    private readonly tripService: TripService,
    private readonly deliveryOrderService: DeliveryOrderService,
    private readonly commerceClient: CommerceClient,
    private readonly eventBus: EventBus,
  ) {}

  async listOffers(riderId: string): Promise<OfferListResponse> {
    const rider = await this.riderOrchestrator.getProfile(riderId)

    if (!rider.available) {
      throw new DomainException(ERROR_CODES.riderOffline, 'El repartidor está offline', 409)
    }
    if (!rider.currentLocation) {
      throw new DomainException(
        ERROR_CODES.locationRequired,
        'Comparte tu ubicación para recibir viajes',
        409,
      )
    }
    if (rider.status === RIDER_STATUS.onTrip) {
      return { data: [] }
    }

    await this.expireStaleOffers()

    const available = await this.deliveryOrderService.listAvailable()
    if (available.length === 0) {
      return { data: [] }
    }

    const selected = this.selectNearest(rider, available)
    if (selected.length === 0) {
      return { data: [] }
    }

    const { routeKm, orders } = this.buildRoute(rider, selected)
    const distanceKm = this.round(routeKm, 2)
    const estimatedMinutes = estimateMinutes(distanceKm, env.offer.avgSpeedKmh)
    const estimatedEarnings = this.estimateEarnings(distanceKm, orders.length)

    const expiresAt = new Date(Date.now() + env.offer.ttlSeconds * 1000)
    const trip = await this.tripService.createOffered({
      riderId,
      orders,
      distanceKm,
      estimatedMinutes,
      estimatedEarnings,
      expiresAt,
    })

    await this.deliveryOrderService.reserve(
      orders.map((order) => order.orderId),
      trip.id,
      expiresAt,
    )

    return {
      data: [
        {
          id: trip.id,
          orderCount: orders.length,
          distanceKm: trip.distanceKm,
          estimatedMinutes: trip.estimatedMinutes,
          estimatedEarnings: trip.estimatedEarnings,
          expiresAt: expiresAt.toISOString(),
        },
      ],
    }
  }

  async acceptOffer(riderId: string, offerId: string): Promise<PublicTrip> {
    const trip = await this.requireOfferedTrip(riderId, offerId)

    const active = await this.tripService.markActive(trip.id)
    await this.deliveryOrderService.markAssigned(trip.orders.map((order) => order.orderId))
    await this.riderOrchestrator.setStatus(riderId, RIDER_STATUS.onTrip)
    await this.eventBus.publish(this.tripAcceptedEvent(trip))

    return active
  }

  async rejectOffer(riderId: string, offerId: string): Promise<void> {
    const trip = await this.requireOfferedTrip(riderId, offerId)

    await this.tripService.markCancelled(trip.id)
    await this.deliveryOrderService.release(trip.id)
  }

  async markPickup(riderId: string, tripId: string, orderId: string): Promise<PublicTrip> {
    const trip = await this.requireOwnedTrip(riderId, tripId)
    this.requireOrderInTrip(trip, orderId)

    await this.commerceClient.patchOrderStatus(orderId, ORDER_STATUS.onTheWay)
    return this.tripService.markOrderPickedUp(tripId, orderId)
  }

  async markDeliver(riderId: string, tripId: string, orderId: string): Promise<PublicTrip> {
    const trip = await this.requireOwnedTrip(riderId, tripId)
    this.requireOrderInTrip(trip, orderId)

    await this.commerceClient.patchOrderStatus(orderId, ORDER_STATUS.delivered)
    const updated = await this.tripService.markOrderDelivered(tripId, orderId)

    if (updated.status === TRIP_STATUS.completed) {
      await this.riderOrchestrator.setStatus(riderId, RIDER_STATUS.free)
      await this.eventBus.publish(this.tripCompletedEvent(updated))
    }

    return updated
  }

  private async expireStaleOffers(): Promise<void> {
    const now = new Date()
    const expiredTripIds = await this.deliveryOrderService.releaseExpired(now)

    for (const tripId of expiredTripIds) {
      const trip = await this.tripService.findById(tripId)
      if (trip && trip.status === TRIP_STATUS.offered) {
        await this.tripService.markCancelled(tripId)
      }
    }
  }

  private async requireOfferedTrip(riderId: string, offerId: string): Promise<PublicTrip> {
    const trip = await this.tripService.findById(offerId)

    if (!trip || trip.riderId !== riderId) {
      throw new DomainException(ERROR_CODES.offerNotFound, 'Oferta no encontrada', 404)
    }
    if (trip.status !== TRIP_STATUS.offered) {
      throw new DomainException(
        ERROR_CODES.invalidTripStatus,
        'La oferta ya no está disponible',
        409,
      )
    }
    if (trip.expiresAt && new Date(trip.expiresAt).getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.offerExpired, 'La oferta venció', 409)
    }

    return trip
  }

  private async requireOwnedTrip(riderId: string, tripId: string): Promise<PublicTrip> {
    const trip = await this.tripService.findById(tripId)

    if (!trip || trip.riderId !== riderId) {
      throw new DomainException(ERROR_CODES.tripNotFound, 'Viaje no encontrado', 404)
    }
    if (trip.status !== TRIP_STATUS.active) {
      throw new DomainException(ERROR_CODES.invalidTripStatus, 'El viaje no está en curso', 409)
    }

    return trip
  }

  private requireOrderInTrip(trip: PublicTrip, orderId: string): void {
    const exists = trip.orders.some((order) => order.orderId === orderId)
    if (!exists) {
      throw new DomainException(ERROR_CODES.orderNotInTrip, 'La orden no pertenece al viaje', 404)
    }
  }

  private selectNearest(rider: PublicRider, orders: PublicDeliveryOrder[]): PublicDeliveryOrder[] {
    const location = rider.currentLocation!

    return orders
      .filter(
        (order) =>
          haversineDistanceKm(location, order.branchLocation) <= env.offer.maxMatchDistanceKm,
      )
      .sort(
        (a, b) =>
          haversineDistanceKm(location, a.branchLocation) -
          haversineDistanceKm(location, b.branchLocation),
      )
      .slice(0, env.offer.maxOrdersPerTrip)
  }

  private buildRoute(
    rider: PublicRider,
    selected: PublicDeliveryOrder[],
  ): { routeKm: number; orders: TripOrder[] } {
    const location = rider.currentLocation!
    let routeKm = 0
    let previous = location

    const orders = selected.map((order) => {
      const toPickup = haversineDistanceKm(previous, order.branchLocation)
      const pickupToDelivery = haversineDistanceKm(order.branchLocation, order.deliveryAddress)
      routeKm += toPickup + pickupToDelivery
      previous = order.deliveryAddress

      return {
        orderId: order.orderId,
        pickupBranchId: order.branchId,
        pickupLocation: order.branchLocation,
        deliveryAddress: order.deliveryAddress,
        status: ORDER_STATUS.readyForDelivery,
        pickedUpAt: null,
        deliveredAt: null,
      }
    })

    return { routeKm, orders }
  }

  private estimateEarnings(routeKm: number, orderCount: number): number {
    const raw =
      env.offer.earningsBase +
      env.offer.earningsPerKm * routeKm +
      env.offer.earningsPerOrder * orderCount
    return Math.round(raw)
  }

  private tripAcceptedEvent(trip: PublicTrip): TripAcceptedEvent {
    return {
      type: TRIP_ACCEPTED_EVENT,
      version: 1,
      eventId: randomUUID(),
      tripId: trip.id,
      riderId: trip.riderId,
      orderIds: trip.orders.map((order) => order.orderId),
    }
  }

  private tripCompletedEvent(trip: PublicTrip): TripCompletedEvent {
    return {
      type: TRIP_COMPLETED_EVENT,
      version: 1,
      eventId: randomUUID(),
      tripId: trip.id,
      riderId: trip.riderId,
      orderIds: trip.orders.map((order) => order.orderId),
    }
  }

  private round(value: number, decimals: number): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }
}
