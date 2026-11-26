import { registerEnumType } from '@nestjs/graphql'

export enum PromotionBadgeKind {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  COUPON = 'COUPON',
  INFORMATIONAL = 'INFORMATIONAL',
}

registerEnumType(PromotionBadgeKind, { name: 'PromotionBadgeKind' })

const BY_STRING: Record<string, PromotionBadgeKind> = {
  percentage: PromotionBadgeKind.PERCENTAGE,
  fixed_amount: PromotionBadgeKind.FIXED_AMOUNT,
  buy_x_get_y: PromotionBadgeKind.BUY_X_GET_Y,
  coupon: PromotionBadgeKind.COUPON,
  informational: PromotionBadgeKind.INFORMATIONAL,
}

export const promotionBadgeKindFromRest = (
  value: string | null | undefined,
): PromotionBadgeKind | null => {
  if (!value) return null
  return BY_STRING[value.toLowerCase()] ?? null
}
