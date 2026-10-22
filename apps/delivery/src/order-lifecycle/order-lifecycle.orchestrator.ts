import { Injectable } from '@nestjs/common'
import { ORDER_STATUS, RIDER_STATUS } from '../config/constants'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { DeliveryOrderService } from '../delivery-order/delivery-order.service'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import { TripService } from '../trip/trip.service'

@Injectable()
export class OrderLifecycleOrchestrator {
  constructor(
    private readonly deliveryOrderService: DeliveryOrderService,
    private readonly tripService: TripService,
    private readonly riderOrchestrator: RiderOrchestrator,
  ) {}

  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (await this.deliveryOrderService.isEventProcessed(event.eventId)) {
      return
    }

    await this.deliveryOrderService.applyStatusChange(event)

    if (event.status === ORDER_STATUS.cancelled) {
      await this.releaseTripForCancelledOrder(event.orderId)
    }

    await this.deliveryOrderService.markEventProcessed(event.eventId)
  }

  private async releaseTripForCancelledOrder(orderId: string): Promise<void> {
    const result = await this.tripService.cancelOrderByOrderId(orderId)

    if (!result?.closed || !result.wasActive) {
      return
    }

    const hasActiveTrip = await this.tripService.hasActiveTrip(result.riderId)
    if (!hasActiveTrip) {
      await this.riderOrchestrator.setStatus(result.riderId, RIDER_STATUS.free)
    }
  }
}
