import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchModule } from '../branch/branch.module'
import { CategoryModule } from '../category/category.module'
import { DatabaseModule } from '../config/database/database.module'
import { IngredientModule } from '../ingredient/ingredient.module'
import { Order, OrderSchema } from '../order/order.model'
import { OrderModule } from '../order/order.module'
import { OrderStateModule } from '../order-state/order-state.module'
import { ParameterModule } from '../parameter/parameter.module'
import { ProductModule } from '../product/product.module'
import { PromotionModule } from '../promotion/promotion.module'
import { StockModule } from '../stock/stock.module'
import { DemoOrdersRepository } from './demo/demo-orders.repository'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    CategoryModule,
    ProductModule,
    IngredientModule,
    PromotionModule,
    BranchModule,
    StockModule,
    ParameterModule,
    OrderStateModule,
    OrderModule,
  ],
  controllers: [SeedController],
  providers: [SeedService, DemoOrdersRepository],
})
export class SeedModule {}
