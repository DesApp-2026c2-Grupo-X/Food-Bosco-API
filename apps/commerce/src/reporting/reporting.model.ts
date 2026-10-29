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
