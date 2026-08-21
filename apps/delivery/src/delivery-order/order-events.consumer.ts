import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBus } from '../config/messaging/event-bus'
import { ORDER_STATUS_CHANGED_EVENT } from '../config/messaging/events'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { DeliveryOrderService } from './delivery-order.service'

@Injectable()
export class OrderEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly deliveryOrderService: DeliveryOrderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe(ORDER_STATUS_CHANGED_EVENT, (event) =>
      this.deliveryOrderService.handleOrderStatusChanged(event as OrderStatusChangedEvent),
    )
  }
}
