import { Injectable, OnModuleInit } from '@nestjs/common'
import { ORDER_STATUS, RIDER_STATUS } from '../config/constants'
import { EventBus } from '../config/messaging/event-bus'
import { ORDER_STATUS_CHANGED_EVENT } from '../config/messaging/events'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { RiderOrchestrator } from '../rider/rider.orchestrator'
import { TripService } from '../trip/trip.service'
import { DeliveryOrderService } from './delivery-order.service'

@Injectable()
export class OrderEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly deliveryOrderService: DeliveryOrderService,
    private readonly tripService: TripService,
    private readonly riderOrchestrator: RiderOrchestrator,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe(ORDER_STATUS_CHANGED_EVENT, (event) =>
      this.handleOrderStatusChanged(event as OrderStatusChangedEvent),
    )
  }

  private async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    await this.deliveryOrderService.handleOrderStatusChanged(event)

    if (event.status === ORDER_STATUS.cancelled) {
      const freedRiderIds = await this.tripService.cancelOrder(event.orderId)
      for (const riderId of freedRiderIds) {
        await this.riderOrchestrator.setStatus(riderId, RIDER_STATUS.free)
      }
    }
  }
}
