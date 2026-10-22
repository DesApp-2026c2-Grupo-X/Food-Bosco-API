import { Injectable } from '@nestjs/common'
import { ERROR_CODES, ORDER_STATUS, TRIP_STATUS, TripStatus } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicTrip, serializeTrip, TripDocument, TripOrder } from './trip.model'
import { TripRepository } from './trip.repository'

export interface CreateOfferedTripInput {
  riderId: string
  orders: TripOrder[]
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  expiresAt: Date
}

export interface TripListResponse {
  data: PublicTrip[]
  meta: { total: number; limit: number; offset: number }
}

export interface CancelOrderResult {
  trip: PublicTrip
  closed: boolean
  riderId: string
  wasActive: boolean
}

const TERMINAL_ORDER_STATUSES: string[] = [ORDER_STATUS.delivered, ORDER_STATUS.cancelled]

@Injectable()
export class TripService {
  constructor(private readonly repository: TripRepository) {}

  async createOffered(input: CreateOfferedTripInput): Promise<PublicTrip> {
    const doc = await this.repository.create({
      riderId: input.riderId,
      status: TRIP_STATUS.offered,
      orders: input.orders,
      distanceKm: input.distanceKm,
      estimatedMinutes: input.estimatedMinutes,
      estimatedEarnings: input.estimatedEarnings,
      expiresAt: input.expiresAt,
    })

    return serializeTrip(doc)
  }

  async findById(id: string): Promise<PublicTrip | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeTrip(doc) : null
  }

  async findByIdForRider(id: string, riderId: string): Promise<PublicTrip | null> {
    const doc = await this.repository.findByIdForRider(id, riderId)
    return doc ? serializeTrip(doc) : null
  }

  async findActiveOffer(riderId: string): Promise<PublicTrip | null> {
    const doc = await this.repository.findActiveOfferByRider(riderId, new Date())
    return doc ? serializeTrip(doc) : null
  }

  async listByRider(riderId: string, limit: number, offset: number): Promise<TripListResponse> {
    const { data, total } = await this.repository.listByRider(riderId, limit, offset)
    return {
      data: data.map(serializeTrip),
      meta: { total, limit, offset },
    }
  }

  async markActive(id: string): Promise<PublicTrip> {
    const doc = await this.requireDocument(id)
    this.assertStatus(doc, [TRIP_STATUS.offered])
    doc.status = TRIP_STATUS.active
    doc.startedAt = new Date()
    doc.expiresAt = null
    await this.repository.save(doc)
    return serializeTrip(doc)
  }

  async markCancelled(id: string): Promise<PublicTrip> {
    const doc = await this.requireDocument(id)
    this.assertStatus(doc, [TRIP_STATUS.offered, TRIP_STATUS.active])
    doc.status = TRIP_STATUS.cancelled
    await this.repository.save(doc)
    return serializeTrip(doc)
  }

  async markOrderPickedUp(id: string, orderId: string): Promise<PublicTrip> {
    const doc = await this.requireDocument(id)
    this.assertStatus(doc, [TRIP_STATUS.active])
    const order = this.findOrder(doc, orderId)

    if (order.status !== ORDER_STATUS.readyForDelivery) {
      throw new DomainException(
        ERROR_CODES.invalidTripStatus,
        'La orden no está lista para retirar',
        409,
      )
    }

    order.status = ORDER_STATUS.onTheWay
    order.pickedUpAt = new Date()
    await this.repository.save(doc)
    return serializeTrip(doc)
  }

  async markOrderDelivered(id: string, orderId: string): Promise<PublicTrip> {
    const doc = await this.requireDocument(id)
    this.assertStatus(doc, [TRIP_STATUS.active])
    const order = this.findOrder(doc, orderId)

    if (order.status !== ORDER_STATUS.onTheWay) {
      throw new DomainException(ERROR_CODES.invalidTripStatus, 'La orden no está en camino', 409)
    }

    order.status = ORDER_STATUS.delivered
    order.deliveredAt = new Date()
    this.closeIfTerminal(doc)

    await this.repository.save(doc)
    return serializeTrip(doc)
  }

  async hasActiveTrip(riderId: string): Promise<boolean> {
    const doc = await this.repository.findActiveByRider(riderId)
    return doc != null
  }

  async cancelOrderByOrderId(orderId: string): Promise<CancelOrderResult | null> {
    const doc = await this.repository.findOpenByOrderId(orderId)

    if (!doc) {
      return this.closedTripResult(orderId)
    }

    const order = this.findOrder(doc, orderId)

    if (order.status === ORDER_STATUS.delivered) {
      throw new DomainException(ERROR_CODES.invalidTripStatus, 'La orden ya fue entregada', 409)
    }

    if (order.status !== ORDER_STATUS.cancelled) {
      order.status = ORDER_STATUS.cancelled
    }

    const closed = this.closeIfTerminal(doc)

    await this.repository.save(doc)

    return this.toCancelResult(doc, closed)
  }

  private async closedTripResult(orderId: string): Promise<CancelOrderResult | null> {
    const doc = await this.repository.findByOrderId(orderId)
    return doc ? this.toCancelResult(doc, true) : null
  }

  private toCancelResult(doc: TripDocument, closed: boolean): CancelOrderResult {
    return {
      trip: serializeTrip(doc),
      closed,
      riderId: doc.riderId,
      wasActive: doc.startedAt != null,
    }
  }

  private closeIfTerminal(doc: TripDocument): boolean {
    const allTerminal = doc.orders.every((order) => TERMINAL_ORDER_STATUSES.includes(order.status))
    if (!allTerminal) {
      return false
    }

    const deliveredCount = doc.orders.filter(
      (order) => order.status === ORDER_STATUS.delivered,
    ).length

    doc.status = deliveredCount > 0 ? TRIP_STATUS.completed : TRIP_STATUS.cancelled
    doc.completedAt = new Date()
    doc.earnings = this.calculateEarnings(doc.estimatedEarnings, deliveredCount, doc.orders.length)
    return true
  }

  // Si el viaje se cierra con órdenes canceladas, se prorratea la ganancia estimada
  // según las órdenes efectivamente entregadas.
  private calculateEarnings(
    estimatedEarnings: number,
    deliveredCount: number,
    totalOrders: number,
  ): number {
    if (deliveredCount === 0 || totalOrders === 0) {
      return 0
    }
    if (deliveredCount === totalOrders) {
      return estimatedEarnings
    }
    return Math.round((estimatedEarnings * deliveredCount) / totalOrders)
  }

  private async requireDocument(id: string): Promise<TripDocument> {
    const doc = await this.repository.findById(id)
    if (!doc) {
      throw new DomainException(ERROR_CODES.tripNotFound, 'Viaje no encontrado', 404)
    }
    return doc
  }

  private findOrder(doc: TripDocument, orderId: string): TripOrder {
    const order = doc.orders.find((entry) => entry.orderId === orderId)
    if (!order) {
      throw new DomainException(ERROR_CODES.orderNotInTrip, 'La orden no pertenece al viaje', 404)
    }
    return order
  }

  private assertStatus(doc: TripDocument, allowed: TripStatus[]): void {
    if (!allowed.includes(doc.status)) {
      throw new DomainException(ERROR_CODES.invalidTripStatus, 'Transición de viaje inválida', 409)
    }
  }
}
