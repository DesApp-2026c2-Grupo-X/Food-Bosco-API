import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PromotionController } from './promotion.controller'
import { Promotion, PromotionSchema } from './promotion.model'
import { PromotionRepository } from './promotion.repository'
import { PromotionService } from './promotion.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Promotion.name, schema: PromotionSchema }])],
  controllers: [PromotionController],
  providers: [PromotionRepository, PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
