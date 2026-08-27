import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Category, CategorySchema } from '../category/category.model'
import { Order, OrderSchema } from '../order/order.model'
import { Product, ProductSchema } from '../product/product.model'
import { BranchStock, BranchStockSchema } from '../stock/branch-stock.model'
import { ReportingController } from './reporting.controller'
import { ReportingRepository } from './reporting.repository'
import { ReportingService } from './reporting.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: BranchStock.name, schema: BranchStockSchema },
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingRepository, ReportingService],
})
export class ReportingModule {}
