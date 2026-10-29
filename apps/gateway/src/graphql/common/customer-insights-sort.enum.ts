import { registerEnumType } from '@nestjs/graphql'

export enum CustomerInsightsSort {
  LAST_PURCHASE = 'LAST_PURCHASE',
  ORDERS = 'ORDERS',
  SPENT = 'SPENT',
}

registerEnumType(CustomerInsightsSort, { name: 'CustomerInsightsSort' })

const TO_REST: Record<CustomerInsightsSort, string> = {
  [CustomerInsightsSort.LAST_PURCHASE]: 'last_purchase',
  [CustomerInsightsSort.ORDERS]: 'orders',
  [CustomerInsightsSort.SPENT]: 'spent',
}

export const customerInsightsSortToRest = (sort: CustomerInsightsSort): string => TO_REST[sort]
