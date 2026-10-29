import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import {
  CUSTOMER_INSIGHTS_DEFAULT_DAYS,
  CUSTOMER_INSIGHTS_DEFAULT_LIMIT,
  CUSTOMER_INSIGHTS_MAX_LIMIT,
  CUSTOMER_INSIGHTS_SORT,
  CUSTOMER_RECURRING_MIN_ORDERS,
} from './reporting.model'
import type {
  CustomerBranchActivityRow,
  CustomerDistributionRow,
  CustomerInsightsFilter,
  CustomerInsightsKpis,
  CustomerInsightsOverview,
  CustomerInsightsRow,
  CustomerInsightsSort,
  ReportGroupBy,
} from './reporting.model'
import { ReportingRepository } from './reporting.repository'

export interface CustomerInsightsQuery {
  from?: string
  to?: string
  branchId?: string
  groupBy?: ReportGroupBy
  limit?: number
  sortBy?: CustomerInsightsSort
}

const DAY_MS = 24 * 60 * 60 * 1000

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const FREQUENCY_BUCKETS = [
  { bucket: '1', label: '1 pedido', min: 1, max: 1 },
  { bucket: '2-3', label: '2 a 3 pedidos', min: 2, max: 3 },
  { bucket: '4-5', label: '4 a 5 pedidos', min: 4, max: 5 },
  { bucket: '6+', label: '6 o más pedidos', min: 6, max: Number.POSITIVE_INFINITY },
]

const RECENCY_BUCKETS = [
  { bucket: '0-7', label: 'Últimos 7 días', max: 7 },
  { bucket: '8-30', label: '8 a 30 días', max: 30 },
  { bucket: '31-90', label: '31 a 90 días', max: 90 },
  { bucket: '90+', label: 'Más de 90 días', max: Number.POSITIVE_INFINITY },
]

const countInRange = (value: number, min: number, max: number): number =>
  value >= min && value <= max ? 1 : 0

@Injectable()
export class CustomerInsightsService {
  constructor(private readonly repository: ReportingRepository) {}

  async overview(
    query: CustomerInsightsQuery = {},
    now: Date = new Date(),
  ): Promise<CustomerInsightsOverview> {
    const range = this.resolveRange(query, now)
    const filter: CustomerInsightsFilter = {
      ...range,
      branchId: query.branchId,
      groupBy: query.groupBy ?? 'month',
      sortBy: query.sortBy ?? CUSTOMER_INSIGHTS_SORT.lastPurchase,
      limit: this.resolveLimit(query.limit),
    }

    const raw = await this.repository.aggregateCustomerInsights(filter)
    const firstPurchases = new Map(
      raw.firstPurchases.map((entry) => [entry._id, entry.firstPurchaseAt]),
    )
    const platformFirstPurchases = new Map(
      raw.platformFirstPurchases.map((entry) => [entry._id, entry.firstPurchaseAt]),
    )

    const buyers = raw.buyers.map((entry) => {
      const clientId = entry._id.toString()
      const firstPurchaseAt = firstPurchases.get(clientId) ?? entry.firstPurchaseAt
      const platformFirstPurchaseAt = platformFirstPurchases.get(clientId) ?? entry.firstPurchaseAt

      return {
        clientId,
        orders: entry.orders,
        totalSpent: entry.totalSpent,
        firstPurchaseAt,
        lastPurchaseAt: entry.lastPurchaseAt,
        isNew: this.isWithin(firstPurchaseAt, range.from, range.to),
        isNewOnPlatform: this.isWithin(platformFirstPurchaseAt, range.from, range.to),
        isRecurring: entry.orders >= CUSTOMER_RECURRING_MIN_ORDERS,
      }
    })

    const totalOrders = buyers.reduce((total, buyer) => total + buyer.orders, 0)
    const totalSpent = buyers.reduce((total, buyer) => total + buyer.totalSpent, 0)
    const newBuyers = buyers.filter((buyer) => buyer.isNew).length

    const kpis: CustomerInsightsKpis = {
      totalBuyers: buyers.length,
      newBuyers,
      returningBuyers: buyers.length - newBuyers,
      recurringBuyers: buyers.filter((buyer) => buyer.isRecurring).length,
      totalOrders,
      totalSpent,
      averageTicket: totalOrders > 0 ? roundTo(totalSpent / totalOrders) : 0,
      averageOrdersPerBuyer: buyers.length > 0 ? roundTo(totalOrders / buyers.length, 1) : 0,
    }

    const branchActivity = await this.toBranchActivity(raw.branchActivity)

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      kpis,
      buyerSeries: raw.series.map((entry) => ({
        bucket: entry._id,
        buyers: entry.buyers,
      })),
      frequency: this.toFrequency(buyers),
      recency: this.toRecency(buyers, now),
      branchActivity,
      customers: this.toRows(buyers, filter, now),
    }
  }

  private resolveRange(query: CustomerInsightsQuery, now: Date): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : now
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - CUSTOMER_INSIGHTS_DEFAULT_DAYS * DAY_MS)

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from.getTime() > to.getTime()
    ) {
      throw new DomainException(ERROR_CODES.validationError, 'Rango de fechas inválido', 400)
    }

    return { from, to }
  }

  private resolveLimit(limit?: number): number {
    if (!limit) {
      return CUSTOMER_INSIGHTS_DEFAULT_LIMIT
    }
    return Math.min(limit, CUSTOMER_INSIGHTS_MAX_LIMIT)
  }

  private isWithin(value: Date, from: Date, to: Date): boolean {
    return value.getTime() >= from.getTime() && value.getTime() <= to.getTime()
  }

  private async toBranchActivity(
    rows: Array<{ _id: string; buyers: number; orders: number; totalSpent: number }>,
  ): Promise<CustomerBranchActivityRow[]> {
    const names = await this.repository.listBranchNames(rows.map((row) => row._id))

    return rows.map((row) => ({
      branchId: row._id,
      branchName: names.get(row._id) ?? '',
      buyers: row.buyers,
      orders: row.orders,
      totalSpent: row.totalSpent,
    }))
  }

  private toFrequency(buyers: Array<{ orders: number }>): CustomerDistributionRow[] {
    return FREQUENCY_BUCKETS.map((bucket) => ({
      bucket: bucket.bucket,
      label: bucket.label,
      buyers: buyers.reduce(
        (total, buyer) => total + countInRange(buyer.orders, bucket.min, bucket.max),
        0,
      ),
    }))
  }

  private toRecency(buyers: Array<{ lastPurchaseAt: Date }>, now: Date): CustomerDistributionRow[] {
    const daysSince = (date: Date): number =>
      Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS))

    return RECENCY_BUCKETS.map((bucket, index) => {
      const previousMax = index === 0 ? -1 : RECENCY_BUCKETS[index - 1].max
      return {
        bucket: bucket.bucket,
        label: bucket.label,
        buyers: buyers.reduce((total, buyer) => {
          const days = daysSince(buyer.lastPurchaseAt)
          return total + (days > previousMax && days <= bucket.max ? 1 : 0)
        }, 0),
      }
    })
  }

  private toRows(
    buyers: Array<{
      clientId: string
      orders: number
      totalSpent: number
      firstPurchaseAt: Date
      lastPurchaseAt: Date
      isNew: boolean
      isNewOnPlatform: boolean
      isRecurring: boolean
    }>,
    filter: CustomerInsightsFilter,
    now: Date,
  ): CustomerInsightsRow[] {
    const sorted = [...buyers].sort((a, b) => {
      if (filter.sortBy === CUSTOMER_INSIGHTS_SORT.orders) {
        return b.orders - a.orders || b.lastPurchaseAt.getTime() - a.lastPurchaseAt.getTime()
      }
      if (filter.sortBy === CUSTOMER_INSIGHTS_SORT.spent) {
        return b.totalSpent - a.totalSpent || b.orders - a.orders
      }
      return b.lastPurchaseAt.getTime() - a.lastPurchaseAt.getTime()
    })

    return sorted.slice(0, filter.limit ?? CUSTOMER_INSIGHTS_DEFAULT_LIMIT).map((buyer) => ({
      clientId: buyer.clientId,
      orders: buyer.orders,
      totalSpent: buyer.totalSpent,
      firstPurchaseAt: buyer.firstPurchaseAt.toISOString(),
      lastPurchaseAt: buyer.lastPurchaseAt.toISOString(),
      daysSinceLastPurchase: Math.max(
        0,
        Math.floor((now.getTime() - buyer.lastPurchaseAt.getTime()) / DAY_MS),
      ),
      isNew: buyer.isNew,
      isNewOnPlatform: buyer.isNewOnPlatform,
      isRecurring: buyer.isRecurring,
    }))
  }
}
