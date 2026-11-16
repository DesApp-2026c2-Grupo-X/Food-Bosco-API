import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchModule } from '../branch/branch.module'
import { OrderModule } from '../order/order.module'
import { OrderReviewController } from './order-review.controller'
import { OrderReview, OrderReviewSchema } from './order-review.model'
import { OrderReviewOrchestrator } from './order-review.orchestrator'
import { OrderReviewRepository } from './order-review.repository'
import { OrderReviewService } from './order-review.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OrderReview.name, schema: OrderReviewSchema }]),
    OrderModule,
    BranchModule,
  ],
  controllers: [OrderReviewController],
  providers: [OrderReviewRepository, OrderReviewService, OrderReviewOrchestrator],
  exports: [OrderReviewService],
})
export class OrderReviewModule {}
