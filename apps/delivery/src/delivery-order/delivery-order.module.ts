import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MessagingModule } from '../config/messaging/messaging.module'
import { RiderModule } from '../rider/rider.module'
import { TripModule } from '../trip/trip.module'
import { DeliveryOrder, DeliveryOrderSchema } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'
import { DeliveryOrderService } from './delivery-order.service'
import { OrderEventsConsumer } from './order-events.consumer'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeliveryOrder.name, schema: DeliveryOrderSchema }]),
    MessagingModule,
    TripModule,
    RiderModule,
  ],
  providers: [DeliveryOrderRepository, DeliveryOrderService, OrderEventsConsumer],
  exports: [DeliveryOrderService],
})
export class DeliveryOrderModule {}
