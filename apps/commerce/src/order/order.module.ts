import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchModule } from '../branch/branch.module'
import { CartModule } from '../cart/cart.module'
import { MessagingModule } from '../config/messaging/messaging.module'
import { ParameterModule } from '../parameter/parameter.module'
import { ProductModule } from '../product/product.module'
import { StockModule } from '../stock/stock.module'
import { Order, OrderSchema } from './order.model'
import { OrderController } from './order.controller'
import { OrderOrchestrator } from './order.orchestrator'
import { OrderRepository } from './order.repository'
import { OrderService } from './order.service'
import { TripEventsConsumer } from './trip-events.consumer'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    CartModule,
    ProductModule,
    BranchModule,
    StockModule,
    ParameterModule,
    MessagingModule,
  ],
  controllers: [OrderController],
  providers: [OrderRepository, OrderService, OrderOrchestrator, TripEventsConsumer],
  exports: [OrderService],
})
export class OrderModule {}
