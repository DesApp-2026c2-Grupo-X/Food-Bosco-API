import { Injectable } from '@nestjs/common'
import { ORDER_STATUS } from '../config/constants'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { PublicDeliveryOrder, serializeDeliveryOrder } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'

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

  async listAvailable(): Promise<PublicDeliveryOrder[]> {
    const docs = await this.repository.listReady()
    return docs.map(serializeDeliveryOrder)
  }

  async reserve(orderIds: string[], tripId: string, reservedUntil: Date): Promise<void> {
    await this.repository.reserve(orderIds, tripId, reservedUntil)
  }

  async markAssigned(orderIds: string[]): Promise<void> {
    await this.repository.markAssigned(orderIds)
  }

  async release(tripId: string): Promise<void> {
    await this.repository.releaseByTripId(tripId)
  }

  async releaseExpired(now: Date): Promise<string[]> {
    const tripIds = await this.repository.findExpiredReservations(now)
    await this.repository.releaseExpired(now)
    return [...new Set(tripIds)]
  }
}
