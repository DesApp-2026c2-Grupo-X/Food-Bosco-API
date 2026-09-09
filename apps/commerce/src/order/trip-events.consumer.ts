import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBus } from '../config/messaging/event-bus'
import { TRIP_ACCEPTED_EVENT, TRIP_COMPLETED_EVENT } from '../config/messaging/events'
import type { TripAcceptedEvent } from '../config/messaging/events'
import { OrderService } from './order.service'

@Injectable()
export class TripEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly orderService: OrderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.eventBus.subscribe(TRIP_ACCEPTED_EVENT, (event) =>
      this.handleTripAccepted(event as TripAcceptedEvent),
    )
    await this.eventBus.subscribe(TRIP_COMPLETED_EVENT, () => undefined)
  }

  private async handleTripAccepted(event: TripAcceptedEvent): Promise<void> {
    await this.orderService.markAssigned(event.orderIds, event.tripId, event.riderId)
  }
}
