import { Module } from '@nestjs/common'
import { MessagingModule } from '../config/messaging/messaging.module'
import { DeliveryOrderModule } from '../delivery-order/delivery-order.module'
import { RiderModule } from '../rider/rider.module'
import { TripModule } from '../trip/trip.module'
import { OrderEventsConsumer } from './order-events.consumer'
import { OrderLifecycleOrchestrator } from './order-lifecycle.orchestrator'

@Module({
  imports: [DeliveryOrderModule, TripModule, RiderModule, MessagingModule],
  providers: [OrderLifecycleOrchestrator, OrderEventsConsumer],
})
export class OrderLifecycleModule {}
