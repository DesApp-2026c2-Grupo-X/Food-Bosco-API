import { Injectable } from '@nestjs/common'
import { PublicCategory, serializeCategory } from '../category/category.model'
import { ERROR_CODES, ORDER_STATUS, ORDER_STATUS_VALUES } from '../config/constants'
import type { OrderStatus } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicProduct, serializeProduct } from '../product/product.model'
import type {
  BranchPerformanceRow,
  OrderStatusCount,
  ProductSalesRow,
  ReportFilter,
  ReportGroupBy,
  ReportsOverview,
  ReportVariation,
  SalesSeriesPoint,
} from './reporting.model'
import { ReportingRepository } from './reporting.repository'
import type { OverviewAggregateRaw } from './reporting.repository'

export interface ProductReportRow {
  position: number
  product: PublicProduct
  category: PublicCategory | null
  quantity: number | null
  revenue: number | null
}

export interface OutOfStockRow {
  product: PublicProduct
  category: PublicCategory | null
  quantity: number
}

export interface ReportQuery {
  branchId?: string
  from?: string
  to?: string
  groupBy?: ReportGroupBy
  categoryId?: string
  status?: OrderStatus
  limit?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_RANGE_DAYS = 30

const applyLimit = <T>(rows: T[], limit?: number): T[] =>
  limit === undefined ? rows : rows.slice(0, limit)

const roundTo = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : roundTo(((current - previous) / previous) * 100)

@Injectable()
export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async bestSellers(query: ReportQuery = {}): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(this.toFilter(query))

    const ranked = products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .filter((entry) => entry.sales.quantity > 0)
      .sort((a, b) => b.sales.quantity - a.sales.quantity)

    return applyLimit(ranked, query.limit).map((entry, index) => ({
      position: index + 1,
      product: entry.product,
      category: categories.get(entry.product.categoryId) ?? null,
      quantity: entry.sales.quantity,
      revenue: null,
    }))
  }

  async leastSold(query: ReportQuery = {}): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(this.toFilter(query))

    const ranked = products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .sort((a, b) => a.sales.quantity - b.sales.quantity)

    return applyLimit(ranked, query.limit).map((entry, index) => ({
      position: index + 1,
      product: entry.product,
      category: categories.get(entry.product.categoryId) ?? null,
      quantity: entry.sales.quantity,
      revenue: null,
    }))
  }

  async highestRevenue(query: ReportQuery = {}): Promise<ProductReportRow[]> {
    const { products, categories, sales } = await this.loadBase(this.toFilter(query))

    const ranked = products
      .map((product) => ({ product, sales: sales.get(product.id) ?? { quantity: 0, revenue: 0 } }))
      .filter((entry) => entry.sales.revenue > 0)
      .sort((a, b) => b.sales.revenue - a.sales.revenue)

    return applyLimit(ranked, query.limit).map((entry, index) => ({
      position: index + 1,
      product: entry.product,
      category: categories.get(entry.product.categoryId) ?? null,
      quantity: null,
      revenue: entry.sales.revenue,
    }))
  }

  async outOfStock(branchId?: string): Promise<OutOfStockRow[]> {
    const { products, categories } = await this.loadBase({ branchId })
    const stock = await this.repository.listStock(branchId)
    const stockByIngredient = new Map(stock.map((entry) => [entry.ingredientId, entry.quantity]))

    const result: OutOfStockRow[] = []

    for (const product of products) {
      if (product.recipe.length === 0) {
        continue
      }
      const minQuantity = Math.min(
        ...product.recipe.map((item) => stockByIngredient.get(item.ingredientId) ?? 0),
      )
      if (minQuantity <= 0) {
        result.push({
          product,
          category: categories.get(product.categoryId) ?? null,
          quantity: 0,
        })
      }
    }

    return result
  }

  async overview(query: ReportQuery = {}, now: Date = new Date()): Promise<ReportsOverview> {
    const range = this.resolveRange(query, now)
    const currentFilter: ReportFilter = { ...this.toFilter(query), ...range }
    const previousFilter: ReportFilter = { ...currentFilter, ...this.previousPeriod(range) }

    const [current, previous] = await Promise.all([
      this.repository.aggregateOverview(currentFilter),
      this.repository.aggregateOverview(previousFilter),
    ])

    const branchPerformance = await this.toBranchPerformance(current)
    const topProducts = current.topProducts.map((row): ProductSalesRow => ({
      productId: row._id,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
    }))

    const currentSales = current.sales[0] ?? { revenue: 0, orders: 0 }
    const previousSales = previous.sales[0] ?? { revenue: 0, orders: 0 }
    const averageTicket = currentSales.orders > 0 ? currentSales.revenue / currentSales.orders : 0
    const previousAverageTicket =
      previousSales.orders > 0 ? previousSales.revenue / previousSales.orders : 0

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      kpis: {
        totalRevenue: currentSales.revenue,
        totalOrders: currentSales.orders,
        averageTicket: roundTo(averageTicket, 2),
        cancelledOrders: this.countStatus(current, ORDER_STATUS.cancelled),
        bestSellingProduct: topProducts[0] ?? null,
        topBranch: branchPerformance[0] ?? null,
      },
      variation: this.toVariation(
        currentSales.revenue,
        previousSales.revenue,
        currentSales.orders,
        previousSales.orders,
        averageTicket,
        previousAverageTicket,
      ),
      salesSeries: current.series.map((row): SalesSeriesPoint => ({
        bucket: row._id,
        revenue: row.revenue,
        orders: row.orders,
      })),
      ordersByStatus: this.toOrdersByStatus(current),
      topProducts,
      branchPerformance,
    }
  }

  private async loadBase(filter: ReportFilter): Promise<{
    products: PublicProduct[]
    categories: Map<string, PublicCategory>
    sales: Map<string, { quantity: number; revenue: number }>
  }> {
    const [productDocs, categoryDocs, sales] = await Promise.all([
      this.repository.listProducts(),
      this.repository.listCategories(),
      this.repository.aggregateSales(filter),
    ])

    const products = filter.categoryId
      ? productDocs.filter((doc) => doc.categoryId === filter.categoryId)
      : productDocs

    return {
      products: products.map(serializeProduct),
      categories: new Map(
        categoryDocs.map((doc) => {
          const category = serializeCategory(doc)
          return [category.id, category]
        }),
      ),
      sales,
    }
  }

  private toFilter(query: ReportQuery): ReportFilter {
    return {
      branchId: query.branchId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      groupBy: query.groupBy,
      categoryId: query.categoryId,
      status: query.status,
    }
  }

  private resolveRange(query: ReportQuery, now: Date): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : now
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS)

    if (from.getTime() > to.getTime()) {
      throw new DomainException(ERROR_CODES.validationError, 'Rango de fechas inválido', 400)
    }

    return { from, to }
  }

  private previousPeriod({ from, to }: { from: Date; to: Date }): { from: Date; to: Date } {
    const duration = to.getTime() - from.getTime()
    const previousTo = new Date(from.getTime() - 1)
    return { from: new Date(previousTo.getTime() - duration), to: previousTo }
  }

  private countStatus(raw: OverviewAggregateRaw, status: OrderStatus): number {
    return raw.status.find((entry) => entry._id === status)?.count ?? 0
  }

  private toOrdersByStatus(raw: OverviewAggregateRaw): OrderStatusCount[] {
    return ORDER_STATUS_VALUES.map((status) => ({
      status,
      count: raw.status.find((entry) => entry._id === status)?.count ?? 0,
    }))
  }

  private async toBranchPerformance(raw: OverviewAggregateRaw): Promise<BranchPerformanceRow[]> {
    const branchIds = raw.branchPerformance.map((entry) => entry._id)
    const names = await this.repository.listBranchNames(branchIds)

    return raw.branchPerformance.map((entry) => ({
      branchId: entry._id,
      branchName: names.get(entry._id) ?? '',
      revenue: entry.revenue,
      orders: entry.orders,
    }))
  }

  private toVariation(
    revenue: number,
    previousRevenue: number,
    orders: number,
    previousOrders: number,
    averageTicket: number,
    previousAverageTicket: number,
  ): ReportVariation {
    return {
      revenuePct: percentChange(revenue, previousRevenue),
      ordersPct: percentChange(orders, previousOrders),
      averageTicketPct: percentChange(averageTicket, previousAverageTicket),
    }
  }
}
