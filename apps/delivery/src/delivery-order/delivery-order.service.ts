import { Injectable } from '@nestjs/common'
import { DELIVERY_ORDER_STATUS, ORDER_STATUS } from '../config/constants'
import { env } from '../config/env'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import type { DeliveryOrderDocument } from './delivery-order.model'
import { PublicDeliveryOrder, serializeDeliveryOrder } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'

export interface RotationContext {
  isActive: (riderId: string) => Promise<boolean>
  eligibleNear: (branchLocation: { latitude: number; longitude: number }) => Promise<string[]>
}

const addWindow = (now: Date): Date =>
  new Date(now.getTime() + env.offer.sameRiderCooldownSeconds * 1000)

@Injectable()
export class DeliveryOrderService {
  constructor(private readonly repository: DeliveryOrderRepository) {}

  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.status === ORDER_STATUS.readyForDelivery) {
      await this.repository.upsertReady({
        orderId: event.orderId,
        branchId: event.branchId,
        branchLocation: event.branchLocation,
        deliveryAddress: event.deliveryAddress,
      })
      return
    }

    if (event.status === ORDER_STATUS.cancelled || event.status === ORDER_STATUS.delivered) {
      await this.repository.remove(event.orderId)
    }
  }

  async claimableForRider(
    riderId: string,
    now: Date,
    ctx: RotationContext,
  ): Promise<PublicDeliveryOrder[]> {
    const docs = await this.repository.listReadyDocs()
    const claimable: PublicDeliveryOrder[] = []

    for (const doc of docs) {
      const current = await this.currentTurn(doc, riderId, now, ctx)
      if (current) {
        claimable.push(serializeDeliveryOrder(doc))
      }
    }

    return claimable
  }

  async reserve(orderIds: string[], tripId: string, reservedUntil: Date): Promise<number> {
    return this.repository.reserve(orderIds, tripId, reservedUntil)
  }

  async markAssigned(orderIds: string[], tripId: string): Promise<void> {
    await this.repository.markAssigned(orderIds, tripId)
  }

  async releaseByTrip(tripId: string, now: Date, ctx: RotationContext): Promise<void> {
    const docs = await this.repository.findReservedDocsByTripId(tripId)
    for (const doc of docs) {
      await this.releaseDoc(doc, now, ctx)
    }
  }

  async releaseExpired(now: Date, ctx: RotationContext): Promise<string[]> {
    const docs = await this.repository.findExpiredReservedDocs(now)
    const tripIds = [
      ...new Set(
        docs.map((doc) => doc.tripId).filter((tripId): tripId is string => tripId !== null),
      ),
    ]

    for (const doc of docs) {
      await this.releaseDoc(doc, now, ctx)
    }

    return tripIds
  }

  private async releaseDoc(
    doc: DeliveryOrderDocument,
    now: Date,
    ctx: RotationContext,
  ): Promise<void> {
    doc.status = DELIVERY_ORDER_STATUS.ready
    doc.tripId = null
    doc.reservedUntil = null

    if (doc.rotationRoster && doc.rotationRoster.length > 0) {
      await this.advanceTurn(doc, now, ctx)
    }

    await doc.save()
  }

  private async currentTurn(
    doc: DeliveryOrderDocument,
    riderId: string,
    now: Date,
    ctx: RotationContext,
  ): Promise<boolean> {
    if (!doc.rotationRoster || doc.rotationRoster.length === 0) {
      const roster = await ctx.eligibleNear(doc.branchLocation)
      if (roster.length === 0) {
        return false
      }
      doc.rotationRoster = roster
      doc.rotationIndex = 0
      doc.rotationTurnUntil = addWindow(now)
      await doc.save()
    }

    let guard = doc.rotationRoster.length * 2 + 2

    while (doc.rotationRoster && doc.rotationRoster.length > 0 && guard > 0) {
      const index = doc.rotationIndex ?? 0
      const current = doc.rotationRoster[index]

      if (current === riderId) {
        return true
      }

      const active = await ctx.isActive(current)
      const expired =
        doc.rotationTurnUntil === null || doc.rotationTurnUntil.getTime() <= now.getTime()

      if (active && !expired) {
        return false
      }

      await this.advanceTurn(doc, now, ctx)
      await doc.save()
      guard -= 1
    }

    return false
  }

  private async advanceTurn(
    doc: DeliveryOrderDocument,
    now: Date,
    ctx: RotationContext,
  ): Promise<void> {
    const roster = doc.rotationRoster
    if (!roster || roster.length === 0) {
      return
    }

    const next = ((doc.rotationIndex ?? 0) + 1) % roster.length

    if (next === 0) {
      const fresh = await ctx.eligibleNear(doc.branchLocation)
      if (fresh.length === 0) {
        doc.rotationRoster = null
        doc.rotationIndex = null
        doc.rotationTurnUntil = null
        return
      }
      const previous = new Set(roster)
      doc.rotationRoster = [
        ...fresh.filter((riderId) => !previous.has(riderId)),
        ...fresh.filter((riderId) => previous.has(riderId)),
      ]
      doc.rotationIndex = 0
    } else {
      doc.rotationIndex = next
    }

    doc.rotationTurnUntil = addWindow(now)
  }
}
