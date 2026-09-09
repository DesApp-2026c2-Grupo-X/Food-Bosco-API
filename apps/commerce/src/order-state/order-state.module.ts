import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { OrderStateController } from './order-state.controller'
import { OrderState, OrderStateSchema } from './order-state.model'
import { OrderStateRepository } from './order-state.repository'
import { OrderStateService } from './order-state.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: OrderState.name, schema: OrderStateSchema }])],
  controllers: [OrderStateController],
  providers: [OrderStateRepository, OrderStateService],
  exports: [OrderStateService],
})
export class OrderStateModule {}
