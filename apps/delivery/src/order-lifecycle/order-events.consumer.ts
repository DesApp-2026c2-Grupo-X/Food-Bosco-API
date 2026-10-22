import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBus } from '../config/messaging/event-bus'
import { ORDER_STATUS_CHANGED_EVENT } from '../config/messaging/events'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { OrderLifecycleOrchestrator } from './order-lifecycle.orchestrator'

@Injectable()
export class OrderEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly orderLifecycleOrchestrator: OrderLifecycleOrchestrator,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe(ORDER_STATUS_CHANGED_EVENT, (event) =>
      this.orderLifecycleOrchestrator.handleOrderStatusChanged(event as OrderStatusChangedEvent),
    )
  }
}
