import { registerEnumType } from '@nestjs/graphql'

export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
}

registerEnumType(PromotionType, { name: 'PromotionType' })

const BY_STRING: Record<string, PromotionType> = {
  percentage: PromotionType.PERCENTAGE,
  fixed_amount: PromotionType.FIXED_AMOUNT,
  buy_x_get_y: PromotionType.BUY_X_GET_Y,
}

export const promotionTypeFromRest = (value: string | null | undefined): PromotionType | null => {
  if (!value) return null
  return BY_STRING[value.toLowerCase()] ?? null
}

export const promotionTypeToRest = (type: PromotionType | null | undefined): string | null => {
  if (!type) return null
  return type
}
