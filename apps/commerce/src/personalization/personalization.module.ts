import { Module } from '@nestjs/common'
import { BranchModule } from '../branch/branch.module'
import { CategoryModule } from '../category/category.module'
import { OrderModule } from '../order/order.module'
import { ProductModule } from '../product/product.module'
import { PromotionModule } from '../promotion/promotion.module'
import { PersonalizationController } from './personalization.controller'
import { PersonalizationOrchestrator } from './personalization.orchestrator'

@Module({
  imports: [OrderModule, ProductModule, CategoryModule, BranchModule, PromotionModule],
  controllers: [PersonalizationController],
  providers: [PersonalizationOrchestrator],
})
export class PersonalizationModule {}
