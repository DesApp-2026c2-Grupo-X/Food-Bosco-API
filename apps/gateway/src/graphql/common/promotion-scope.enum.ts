import { registerEnumType } from '@nestjs/graphql'

export enum PromotionScope {
  ORDER = 'ORDER',
  CATEGORY = 'CATEGORY',
  PRODUCT = 'PRODUCT',
}

registerEnumType(PromotionScope, { name: 'PromotionScope' })

const BY_STRING: Record<string, PromotionScope> = {
  order: PromotionScope.ORDER,
  category: PromotionScope.CATEGORY,
  product: PromotionScope.PRODUCT,
}

export const promotionScopeFromRest = (value: string | null | undefined): PromotionScope | null => {
  if (!value) return null
  return BY_STRING[value.toLowerCase()] ?? null
}

export const promotionScopeToRest = (scope: PromotionScope | null | undefined): string | null => {
  if (!scope) return null
  return scope
}
