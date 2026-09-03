import { Module } from '@nestjs/common'
import { DatabaseModule } from '../config/database/database.module'
import { BranchModule } from '../branch/branch.module'
import { CategoryModule } from '../category/category.module'
import { IngredientModule } from '../ingredient/ingredient.module'
import { OrderStateModule } from '../order-state/order-state.module'
import { ParameterModule } from '../parameter/parameter.module'
import { ProductModule } from '../product/product.module'
import { PromotionModule } from '../promotion/promotion.module'
import { StockModule } from '../stock/stock.module'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [
    DatabaseModule,
    CategoryModule,
    ProductModule,
    IngredientModule,
    PromotionModule,
    BranchModule,
    StockModule,
    ParameterModule,
    OrderStateModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
