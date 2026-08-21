import { registerEnumType } from '@nestjs/graphql'

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(OrderStatus, { name: 'OrderStatus' })

const BY_STRING: Record<string, OrderStatus> = {
  pending: OrderStatus.PENDING,
  confirmed: OrderStatus.CONFIRMED,
  preparing: OrderStatus.PREPARING,
  ready_for_delivery: OrderStatus.READY_FOR_DELIVERY,
  on_the_way: OrderStatus.ON_THE_WAY,
  delivered: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELLED,
}

export const orderStatusFromRest = (value: string): OrderStatus => {
  const status = BY_STRING[value.toLowerCase()]
  if (!status) {
    throw new Error(`Unknown order status: ${value}`)
  }
  return status
}

export const orderStatusToRest = (status: OrderStatus): string => status.toLowerCase()
