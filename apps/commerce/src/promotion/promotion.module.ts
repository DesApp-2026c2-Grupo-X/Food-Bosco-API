import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchModule } from '../branch/branch.module'
import { CategoryModule } from '../category/category.module'
import { ProductModule } from '../product/product.module'
import { PromotionController } from './promotion.controller'
import { Promotion, PromotionSchema } from './promotion.model'
import { PromotionRedemption, PromotionRedemptionSchema } from './promotion-redemption.model'
import { PromotionRedemptionRepository } from './promotion-redemption.repository'
import { PromotionRepository } from './promotion.repository'
import { PromotionOrchestrator } from './promotion.orchestrator'
import { PromotionService } from './promotion.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Promotion.name, schema: PromotionSchema },
      { name: PromotionRedemption.name, schema: PromotionRedemptionSchema },
    ]),
    forwardRef(() => CategoryModule),
    forwardRef(() => ProductModule),
    forwardRef(() => BranchModule),
  ],
  controllers: [PromotionController],
  providers: [
    PromotionRepository,
    PromotionRedemptionRepository,
    PromotionService,
    PromotionOrchestrator,
  ],
  exports: [PromotionService, PromotionOrchestrator],
})
export class PromotionModule {}
