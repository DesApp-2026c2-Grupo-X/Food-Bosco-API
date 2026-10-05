import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, PipelineStage } from 'mongoose'
import { ORDER_STATUS } from '../config/constants'
import type { OrderStatus } from '../config/constants'
import { Branch, BranchDocument } from '../branch/branch.model'
import { Category, CategoryDocument } from '../category/category.model'
import { Order, OrderDocument } from '../order/order.model'
import { Product, ProductDocument } from '../product/product.model'
import { BranchStock, BranchStockDocument } from '../stock/branch-stock.model'
import type { ReportFilter, ReportGroupBy } from './reporting.model'

export interface SalesAggregate {
  quantity: number
  revenue: number
}

export interface OverviewAggregateRaw {
  sales: Array<{ revenue: number; orders: number }>
  status: Array<{ _id: OrderStatus; count: number }>
  series: Array<{ _id: string; revenue: number; orders: number }>
  topProducts: Array<{ _id: string; name: string; quantity: number; revenue: number }>
  branchPerformance: Array<{ _id: string; revenue: number; orders: number }>
}

const REPORT_TIMEZONE = 'America/Argentina/Buenos_Aires'
const TOP_PRODUCTS_LIMIT = 10

const GROUP_FORMATS: Record<ReportGroupBy, string> = {
  day: '%Y-%m-%d',
  week: '%G-W%V',
  month: '%Y-%m',
}

const buildOrderMatch = (filter: ReportFilter): Record<string, unknown> => {
  const match: Record<string, unknown> = {}

  if (filter.branchId) match.branchId = filter.branchId

  if (filter.from || filter.to) {
    const range: Record<string, Date> = {}
    if (filter.from) range.$gte = filter.from
    if (filter.to) range.$lte = filter.to
    match.createdAt = range
  }

  return match
}

const salesStatusMatch = (filter: ReportFilter): Record<string, unknown> =>
  filter.status ? { status: filter.status } : { status: { $ne: ORDER_STATUS.cancelled } }

const emptyOverview = (): OverviewAggregateRaw => ({
  sales: [],
  status: [],
  series: [],
  topProducts: [],
  branchPerformance: [],
})

@Injectable()
export class ReportingRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(BranchStock.name) private readonly stockModel: Model<BranchStockDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
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

  async listBranchNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()

    const branches = await this.branchModel.find({ _id: { $in: ids } }).exec()
    return new Map(branches.map((branch) => [branch._id.toString(), branch.name]))
  }

  async aggregateSales(filter: ReportFilter = {}): Promise<Map<string, SalesAggregate>> {
    const productIds = await this.findProductIdsByCategory(filter.categoryId)
    if (productIds && productIds.length === 0) return new Map()

    const itemMatch = productIds ? [{ $match: { 'items.productId': { $in: productIds } } }] : []

    const pipeline: PipelineStage[] = [
      { $match: buildOrderMatch(filter) },
      { $match: salesStatusMatch(filter) },
      ...itemMatch,
      { $unwind: '$items' },
      ...itemMatch,
      {
        $group: {
          _id: '$items.productId',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.subtotal' },
        },
      },
    ]

    const rows = await this.orderModel
      .aggregate<{ _id: string; quantity: number; revenue: number }>(pipeline)
      .exec()

    return new Map(rows.map((row) => [row._id, { quantity: row.quantity, revenue: row.revenue }]))
  }

  async aggregateOverview(filter: ReportFilter): Promise<OverviewAggregateRaw> {
    const groupFormat = GROUP_FORMATS[filter.groupBy ?? 'day']

    const pipeline: PipelineStage[] = [
      { $match: buildOrderMatch(filter) },
      {
        $facet: {
          sales: [
            { $match: salesStatusMatch(filter) },
            { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
          ],
          status: [
            { $match: filter.status ? { status: filter.status } : {} },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          series: [
            { $match: salesStatusMatch(filter) },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: groupFormat,
                    date: '$createdAt',
                    timezone: REPORT_TIMEZONE,
                  },
                },
                revenue: { $sum: '$total' },
                orders: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          topProducts: [
            { $match: salesStatusMatch(filter) },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.productId',
                name: { $last: '$items.name' },
                quantity: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.subtotal' },
              },
            },
            { $sort: { quantity: -1, revenue: -1 } },
            { $limit: TOP_PRODUCTS_LIMIT },
          ],
          branchPerformance: [
            { $match: salesStatusMatch(filter) },
            { $group: { _id: '$branchId', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { revenue: -1 } },
          ],
        },
      },
    ]

    const [result] = await this.orderModel.aggregate<OverviewAggregateRaw>(pipeline).exec()
    return result ?? emptyOverview()
  }

  private async findProductIdsByCategory(categoryId?: string): Promise<string[] | null> {
    if (!categoryId) return null

    const products = await this.productModel.find({ categoryId }).select({ _id: 1 }).exec()
    return products.map((product) => product._id.toString())
  }
}
