import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, PipelineStage } from 'mongoose'
import { BUSINESS_TIME_ZONE, ORDER_STATUS } from '../config/constants'
import type { OrderStatus } from '../config/constants'
import { Branch, BranchDocument } from '../branch/branch.model'
import { Category, CategoryDocument } from '../category/category.model'
import { Order, OrderDocument } from '../order/order.model'
import { Product, ProductDocument } from '../product/product.model'
import { BranchStock, BranchStockDocument } from '../stock/branch-stock.model'
import { CUSTOMER_FREQUENT_PRODUCTS_LIMIT } from './reporting.model'
import type {
  CustomerInsightsFilter,
  CustomerReportFilter,
  ReportFilter,
  ReportGroupBy,
} from './reporting.model'

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

export interface CustomerOverviewAggregateRaw {
  summary: Array<{
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    activeOrders: number
    totalSpent: number
  }>
  status: Array<{ _id: OrderStatus; count: number }>
  series: Array<{ _id: string; orders: number; completedOrders: number; totalSpent: number }>
  frequentProducts: Array<{
    _id: string
    name: string
    quantity: number
    orders: number
    totalSpent: number
  }>
  branches: Array<{ _id: string; orders: number; totalSpent: number }>
}

export interface CustomerInsightsAggregateRaw {
  buyers: Array<{
    _id: string
    orders: number
    totalSpent: number
    firstPurchaseAt: Date
    lastPurchaseAt: Date
  }>
  series: Array<{ _id: string; buyers: number }>
  branchActivity: Array<{ _id: string; buyers: number; orders: number; totalSpent: number }>
  firstPurchases: Array<{ _id: string; firstPurchaseAt: Date }>
  platformFirstPurchases: Array<{ _id: string; firstPurchaseAt: Date }>
}

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

const ACTIVE_CUSTOMER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.pending,
  ORDER_STATUS.confirmed,
  ORDER_STATUS.preparing,
  ORDER_STATUS.readyForDelivery,
  ORDER_STATUS.onTheWay,
]

const completedOrdersExpr = {
  $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.delivered] }, 1, 0] },
}

const cancelledOrdersExpr = {
  $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.cancelled] }, 1, 0] },
}

const activeOrdersExpr = {
  $sum: { $cond: [{ $in: ['$status', ACTIVE_CUSTOMER_STATUSES] }, 1, 0] },
}

const totalSpentExpr = {
  $sum: { $cond: [{ $eq: ['$status', ORDER_STATUS.delivered] }, '$total', 0] },
}

const buildCustomerOrderMatch = (
  clientId: string,
  filter: CustomerReportFilter,
): Record<string, unknown> => ({
  clientId,
  createdAt: { $gte: filter.from, $lte: filter.to },
})

const emptyCustomerOverview = (): CustomerOverviewAggregateRaw => ({
  summary: [],
  status: [],
  series: [],
  frequentProducts: [],
  branches: [],
})

const emptyCustomerInsights = (): CustomerInsightsAggregateRaw => ({
  buyers: [],
  series: [],
  branchActivity: [],
  firstPurchases: [],
  platformFirstPurchases: [],
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
                    timezone: BUSINESS_TIME_ZONE,
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

  async aggregateCustomerOverview(
    clientId: string,
    filter: CustomerReportFilter,
  ): Promise<CustomerOverviewAggregateRaw> {
    const groupFormat = GROUP_FORMATS[filter.groupBy ?? 'month']

    const pipeline: PipelineStage[] = [
      { $match: buildCustomerOrderMatch(clientId, filter) },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                completedOrders: completedOrdersExpr,
                cancelledOrders: cancelledOrdersExpr,
                activeOrders: activeOrdersExpr,
                totalSpent: totalSpentExpr,
              },
            },
          ],
          status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          series: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: groupFormat,
                    date: '$createdAt',
                    timezone: BUSINESS_TIME_ZONE,
                  },
                },
                orders: { $sum: 1 },
                completedOrders: completedOrdersExpr,
                totalSpent: totalSpentExpr,
              },
            },
            { $sort: { _id: 1 } },
          ],
          frequentProducts: [
            { $match: { status: ORDER_STATUS.delivered } },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.productId',
                name: { $last: '$items.name' },
                quantity: { $sum: '$items.quantity' },
                orders: { $addToSet: '$_id' },
                totalSpent: { $sum: '$items.subtotal' },
              },
            },
            {
              $project: {
                name: 1,
                quantity: 1,
                totalSpent: 1,
                orders: { $size: '$orders' },
              },
            },
            { $sort: { quantity: -1, totalSpent: -1, name: 1 } },
            { $limit: CUSTOMER_FREQUENT_PRODUCTS_LIMIT },
          ],
          branches: [
            { $match: { status: ORDER_STATUS.delivered } },
            {
              $group: {
                _id: '$branchId',
                orders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
              },
            },
            { $sort: { orders: -1, totalSpent: -1 } },
            { $limit: 1 },
          ],
        },
      },
    ]

    const [result] = await this.orderModel.aggregate<CustomerOverviewAggregateRaw>(pipeline).exec()
    return result ?? emptyCustomerOverview()
  }

  async aggregateCustomerInsights(
    filter: CustomerInsightsFilter,
  ): Promise<CustomerInsightsAggregateRaw> {
    const groupFormat = GROUP_FORMATS[filter.groupBy ?? 'month']
    const scopeMatch: Record<string, unknown> = { status: ORDER_STATUS.delivered }

    if (filter.branchId) {
      scopeMatch.branchId = filter.branchId
    }

    const periodMatch: Record<string, unknown> = {
      ...scopeMatch,
      createdAt: { $gte: filter.from, $lte: filter.to },
    }

    const firstPurchasePipeline = (
      match: Record<string, unknown>,
    ): PipelineStage.FacetPipelineStage[] => [
      { $match: match },
      { $group: { _id: '$clientId', firstPurchaseAt: { $min: '$createdAt' } } },
    ]

    const pipeline: PipelineStage[] = [
      {
        $facet: {
          buyers: [
            { $match: periodMatch },
            {
              $group: {
                _id: '$clientId',
                orders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
                firstPurchaseAt: { $min: '$createdAt' },
                lastPurchaseAt: { $max: '$createdAt' },
              },
            },
            { $sort: { lastPurchaseAt: -1 } },
          ],
          series: [
            { $match: periodMatch },
            {
              $group: {
                _id: {
                  clientId: '$clientId',
                  bucket: {
                    $dateToString: {
                      format: groupFormat,
                      date: '$createdAt',
                      timezone: BUSINESS_TIME_ZONE,
                    },
                  },
                },
              },
            },
            { $group: { _id: '$_id.bucket', buyers: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          branchActivity: [
            { $match: periodMatch },
            {
              $group: {
                _id: { branchId: '$branchId', clientId: '$clientId' },
                orders: { $sum: 1 },
                totalSpent: { $sum: '$total' },
              },
            },
            {
              $group: {
                _id: '$_id.branchId',
                buyers: { $sum: 1 },
                orders: { $sum: '$orders' },
                totalSpent: { $sum: '$totalSpent' },
              },
            },
            { $sort: { buyers: -1, orders: -1 } },
          ],
          firstPurchases: firstPurchasePipeline({
            ...scopeMatch,
            createdAt: { $lte: filter.to },
          }),
          platformFirstPurchases: firstPurchasePipeline({
            status: ORDER_STATUS.delivered,
            createdAt: { $lte: filter.to },
          }),
        },
      },
    ]

    const [result] = await this.orderModel.aggregate<CustomerInsightsAggregateRaw>(pipeline).exec()
    return result ?? emptyCustomerInsights()
  }

  private async findProductIdsByCategory(categoryId?: string): Promise<string[] | null> {
    if (!categoryId) return null

    const products = await this.productModel.find({ categoryId }).select({ _id: 1 }).exec()
    return products.map((product) => product._id.toString())
  }
}
