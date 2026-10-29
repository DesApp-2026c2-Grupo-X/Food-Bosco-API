import type { OrderStatus } from '../config/constants'

export const REPORT_GROUP_BY = {
  day: 'day',
  week: 'week',
  month: 'month',
} as const

export type ReportGroupBy = (typeof REPORT_GROUP_BY)[keyof typeof REPORT_GROUP_BY]

export const REPORT_GROUP_BY_VALUES: ReportGroupBy[] = [
  REPORT_GROUP_BY.day,
  REPORT_GROUP_BY.week,
  REPORT_GROUP_BY.month,
]

export interface ReportFilter {
  branchId?: string
  from?: Date
  to?: Date
  groupBy?: ReportGroupBy
  categoryId?: string
  status?: OrderStatus
}

export interface ReportPeriod {
  from: string
  to: string
}

export interface ProductSalesRow {
  productId: string
  name: string
  quantity: number
  revenue: number
}

export interface ReportKpis {
  totalRevenue: number
  totalOrders: number
  averageTicket: number
  cancelledOrders: number
  bestSellingProduct: ProductSalesRow | null
  topBranch: BranchPerformanceRow | null
}

export interface ReportVariation {
  revenuePct: number | null
  ordersPct: number | null
  averageTicketPct: number | null
}

export interface SalesSeriesPoint {
  bucket: string
  revenue: number
  orders: number
}

export interface OrderStatusCount {
  status: OrderStatus
  count: number
}

export interface BranchPerformanceRow {
  branchId: string
  branchName: string
  revenue: number
  orders: number
}

export interface ReportsOverview {
  period: ReportPeriod
  kpis: ReportKpis
  variation: ReportVariation
  salesSeries: SalesSeriesPoint[]
  ordersByStatus: OrderStatusCount[]
  topProducts: ProductSalesRow[]
  branchPerformance: BranchPerformanceRow[]
}

export const CUSTOMER_REPORT_DEFAULT_DAYS = 365
export const CUSTOMER_FREQUENT_PRODUCTS_LIMIT = 5

export interface CustomerReportFilter {
  from: Date
  to: Date
  groupBy?: ReportGroupBy
}

export interface CustomerBranchRow {
  branchId: string
  branchName: string
  orders: number
  totalSpent: number
}

export interface CustomerReportSummary {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  activeOrders: number
  totalSpent: number
  averageTicket: number
  favoriteBranch: CustomerBranchRow | null
}

export interface CustomerActivityPoint {
  bucket: string
  orders: number
  completedOrders: number
  totalSpent: number
}

export interface CustomerProductRow {
  productId: string
  name: string
  quantity: number
  orders: number
  totalSpent: number
}

export interface CustomerReportsOverview {
  period: ReportPeriod
  summary: CustomerReportSummary
  activitySeries: CustomerActivityPoint[]
  frequentProducts: CustomerProductRow[]
  ordersByStatus: OrderStatusCount[]
}

export const CUSTOMER_INSIGHTS_DEFAULT_DAYS = 30
export const CUSTOMER_INSIGHTS_DEFAULT_LIMIT = 100
export const CUSTOMER_INSIGHTS_MAX_LIMIT = 500
export const CUSTOMER_RECURRING_MIN_ORDERS = 2

export const CUSTOMER_INSIGHTS_SORT = {
  lastPurchase: 'last_purchase',
  orders: 'orders',
  spent: 'spent',
} as const

export type CustomerInsightsSort =
  (typeof CUSTOMER_INSIGHTS_SORT)[keyof typeof CUSTOMER_INSIGHTS_SORT]

export const CUSTOMER_INSIGHTS_SORT_VALUES: CustomerInsightsSort[] = [
  CUSTOMER_INSIGHTS_SORT.lastPurchase,
  CUSTOMER_INSIGHTS_SORT.orders,
  CUSTOMER_INSIGHTS_SORT.spent,
]

export interface CustomerInsightsFilter {
  from: Date
  to: Date
  branchId?: string
  groupBy?: ReportGroupBy
  limit?: number
  sortBy?: CustomerInsightsSort
}

export interface CustomerInsightsKpis {
  totalBuyers: number
  newBuyers: number
  returningBuyers: number
  recurringBuyers: number
  totalOrders: number
  totalSpent: number
  averageTicket: number
  averageOrdersPerBuyer: number
}

export interface CustomerBuyerSeriesPoint {
  bucket: string
  buyers: number
}

export interface CustomerDistributionRow {
  bucket: string
  label: string
  buyers: number
}

export interface CustomerBranchActivityRow {
  branchId: string
  branchName: string
  buyers: number
  orders: number
  totalSpent: number
}

export interface CustomerInsightsRow {
  clientId: string
  orders: number
  totalSpent: number
  firstPurchaseAt: string
  lastPurchaseAt: string
  daysSinceLastPurchase: number
  isNew: boolean
  isNewOnPlatform: boolean
  isRecurring: boolean
}

export interface CustomerInsightsOverview {
  period: ReportPeriod
  kpis: CustomerInsightsKpis
  buyerSeries: CustomerBuyerSeriesPoint[]
  frequency: CustomerDistributionRow[]
  recency: CustomerDistributionRow[]
  branchActivity: CustomerBranchActivityRow[]
  customers: CustomerInsightsRow[]
}
