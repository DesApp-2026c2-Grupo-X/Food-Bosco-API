import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  DeliveryOrder,
  DeliveryOrderSchema,
  ProcessedEvent,
  ProcessedEventSchema,
} from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'
import { DeliveryOrderService } from './delivery-order.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryOrder.name, schema: DeliveryOrderSchema },
      { name: ProcessedEvent.name, schema: ProcessedEventSchema },
    ]),
  ],
  providers: [DeliveryOrderRepository, DeliveryOrderService],
  exports: [DeliveryOrderService, DeliveryOrderRepository],
})
export class DeliveryOrderModule {}
