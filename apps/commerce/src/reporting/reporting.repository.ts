import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BranchStock, BranchStockDocument } from '../stock/branch-stock.model'
import { Category, CategoryDocument } from '../category/category.model'
import { Order, OrderDocument } from '../order/order.model'
import { Product, ProductDocument } from '../product/product.model'

export interface SalesAggregate {
  quantity: number
  revenue: number
}

@Injectable()
export class ReportingRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(BranchStock.name) private readonly stockModel: Model<BranchStockDocument>,
  ) {}

  listProducts(): Promise<ProductDocument[]> {
    return this.productModel.find().sort({ name: 1 }).exec()
  }

  listCategories(): Promise<CategoryDocument[]> {
    return this.categoryModel.find().exec()
  }

  listStock(branchId?: string): Promise<BranchStockDocument[]> {
    return this.stockModel.find(branchId ? { branchId } : {}).exec()
  }

  async aggregateSales(branchId?: string): Promise<Map<string, SalesAggregate>> {
    const orders = await this.orderModel.find(branchId ? { branchId } : {}).exec()

    const result = new Map<string, SalesAggregate>()
    for (const order of orders) {
      for (const item of order.items) {
        const current = result.get(item.productId) ?? { quantity: 0, revenue: 0 }
        current.quantity += item.quantity
        current.revenue += item.subtotal
        result.set(item.productId, current)
      }
    }

    return result
  }
}
