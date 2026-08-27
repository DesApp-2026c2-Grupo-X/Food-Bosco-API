import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProductModule } from '../product/product.module'
import { CartController } from './cart.controller'
import { Cart, CartSchema } from './cart.model'
import { CartOrchestrator } from './cart.orchestrator'
import { CartRepository } from './cart.repository'
import { CartService } from './cart.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    ProductModule,
  ],
  controllers: [CartController],
  providers: [CartRepository, CartService, CartOrchestrator],
  exports: [CartService, CartOrchestrator],
})
export class CartModule {}
