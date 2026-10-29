import { Injectable } from '@nestjs/common'
import { ERROR_CODES, ORDER_STATUS_VALUES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type {
  CustomerActivityPoint,
  CustomerBranchRow,
  CustomerProductRow,
  CustomerReportSummary,
  CustomerReportsOverview,
  ReportGroupBy,
} from './reporting.model'
import { CUSTOMER_REPORT_DEFAULT_DAYS } from './reporting.model'
import { ReportingRepository } from './reporting.repository'

export interface CustomerReportQuery {
  from?: string
  to?: string
  groupBy?: ReportGroupBy
}

const DAY_MS = 24 * 60 * 60 * 1000

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const emptySummary = (): Omit<CustomerReportSummary, 'favoriteBranch'> => ({
  totalOrders: 0,
  completedOrders: 0,
  cancelledOrders: 0,
  activeOrders: 0,
  totalSpent: 0,
  averageTicket: 0,
})

@Injectable()
export class CustomerReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async overview(
    clientId: string,
    query: CustomerReportQuery = {},
    now: Date = new Date(),
  ): Promise<CustomerReportsOverview> {
    if (!clientId) {
      throw new DomainException(ERROR_CODES.unauthenticated, 'Identidad no resoluble', 401)
    }

    const range = this.resolveRange(query, now)
    const raw = await this.repository.aggregateCustomerOverview(clientId, {
      ...range,
      groupBy: query.groupBy ?? 'month',
    })

    const summaryRaw = raw.summary[0] ?? emptySummary()
    const favoriteBranch = await this.toFavoriteBranch(raw.branches[0])
    const averageTicket =
      summaryRaw.completedOrders > 0
        ? roundTo(summaryRaw.totalSpent / summaryRaw.completedOrders)
        : 0

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      summary: {
        ...summaryRaw,
        averageTicket,
        favoriteBranch,
      },
      activitySeries: raw.series.map((row): CustomerActivityPoint => ({
        bucket: row._id,
        orders: row.orders,
        completedOrders: row.completedOrders,
        totalSpent: row.totalSpent,
      })),
      frequentProducts: raw.frequentProducts.map((row): CustomerProductRow => ({
        productId: row._id,
        name: row.name,
        quantity: row.quantity,
        orders: row.orders,
        totalSpent: row.totalSpent,
      })),
      ordersByStatus: ORDER_STATUS_VALUES.map((status) => ({
        status,
        count: raw.status.find((entry) => entry._id === status)?.count ?? 0,
      })),
    }
  }

  private resolveRange(query: CustomerReportQuery, now: Date): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : now
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - CUSTOMER_REPORT_DEFAULT_DAYS * DAY_MS)

    if (from.getTime() > to.getTime()) {
      throw new DomainException(ERROR_CODES.validationError, 'Rango de fechas inválido', 400)
    }

    return { from, to }
  }

  private async toFavoriteBranch(
    branch: { _id: string; orders: number; totalSpent: number } | undefined,
  ): Promise<CustomerBranchRow | null> {
    if (!branch) {
      return null
    }

    const names = await this.repository.listBranchNames([branch._id])

    return {
      branchId: branch._id,
      branchName: names.get(branch._id) ?? '',
      orders: branch.orders,
      totalSpent: branch.totalSpent,
    }
  }
}
