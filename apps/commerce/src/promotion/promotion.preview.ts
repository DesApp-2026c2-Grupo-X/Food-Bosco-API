import type { PublicCategory } from '../category/category.model'
import { PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import type { PublicProduct } from '../product/product.model'
import { isBranchMatch, isScheduleMatch } from './promotion.engine'
import type {
  ProductPromotionPreview,
  PromotionBadgeKind,
  PublicPromotion,
} from './promotion.model'

export interface ProductPreviewResult {
  promotion: ProductPromotionPreview | null
  promotions: ProductPromotionPreview[]
  promotionCount: number
}

export interface PublicPromotionCatalogItem {
  id: string
  name: string
  description: string | null
  type: PublicPromotion['type']
  scope: PublicPromotion['scope']
  kind: PromotionBadgeKind
  badge: string
  discountValue: number | null
  maxDiscount: number | null
  buyQuantity: number | null
  payQuantity: number | null
  startDate: string
  endDate: string
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  minSubtotal: number
  minQuantity: number
  branchIds: string[]
  code: string | null
  categoryIds: string[]
  productIds: string[]
  categories: PublicCategory[]
  products: PublicProduct[]
}

interface ScoredPreview {
  preview: ProductPromotionPreview
  score: number
  priority: number
}

const MONEY_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const PERCENT_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

const formatMoney = (value: number): string => MONEY_FORMATTER.format(value)
const formatPercent = (value: number): string => PERCENT_FORMATTER.format(value)

const appliesToProduct = (promotion: PublicPromotion, product: PublicProduct): boolean => {
  if (promotion.scope === PROMOTION_SCOPE.product) {
    return promotion.productIds.includes(product.id)
  }
  if (promotion.scope === PROMOTION_SCOPE.category) {
    return promotion.categoryIds.includes(product.categoryId)
  }
  return false
}

const isEligibleForProduct = (
  promotion: PublicPromotion,
  product: PublicProduct,
  branchId: string | null,
  now: Date,
): boolean =>
  promotion.active &&
  promotion.type !== null &&
  promotion.code === null &&
  product.available &&
  appliesToProduct(promotion, product) &&
  isScheduleMatch(promotion, now) &&
  isBranchMatch(promotion, branchId)

const resolveKind = (promotion: PublicPromotion): PromotionBadgeKind => {
  if (promotion.code) return 'COUPON'
  if (promotion.type === PROMOTION_TYPE.percentage) return 'PERCENTAGE'
  if (promotion.type === PROMOTION_TYPE.fixedAmount) return 'FIXED_AMOUNT'
  if (promotion.type === PROMOTION_TYPE.buyXGetY) return 'BUY_X_GET_Y'
  return 'INFORMATIONAL'
}

const resolveBadge = (promotion: PublicPromotion): string => {
  if (promotion.code) return 'Cupón'
  if (promotion.type === PROMOTION_TYPE.percentage) {
    return `-${formatPercent(promotion.discountValue ?? 0)}%`
  }
  if (promotion.type === PROMOTION_TYPE.fixedAmount) {
    return `Hasta $${formatMoney(promotion.discountValue ?? 0)} OFF`
  }
  if (promotion.type === PROMOTION_TYPE.buyXGetY) {
    return `${promotion.buyQuantity ?? 0}x${promotion.payQuantity ?? 0}`
  }
  return 'Beneficio'
}

const resolveScore = (promotion: PublicPromotion, price: number): number => {
  if (promotion.type === PROMOTION_TYPE.percentage) {
    const raw = Math.round((price * (promotion.discountValue ?? 0)) / 100)
    return promotion.maxDiscount !== null ? Math.min(raw, promotion.maxDiscount) : raw
  }
  if (promotion.type === PROMOTION_TYPE.fixedAmount) {
    return Math.min(promotion.discountValue ?? 0, price)
  }
  if (promotion.type === PROMOTION_TYPE.buyXGetY) {
    const buy = promotion.buyQuantity ?? 0
    const pay = promotion.payQuantity ?? 0
    return buy > pay ? (price * (buy - pay)) / buy : 0
  }
  return 0
}

const resolveEstimatedUnitPrice = (
  promotion: PublicPromotion,
  price: number,
  conditionsMet: boolean,
): number | null => {
  if (!conditionsMet) return null
  if (promotion.type !== PROMOTION_TYPE.percentage) return null
  if (promotion.maxDiscount !== null) return null

  const raw = Math.round((price * (promotion.discountValue ?? 0)) / 100)
  return Math.max(0, price - raw)
}

const buildScoredPreview = (promotion: PublicPromotion, product: PublicProduct): ScoredPreview => {
  const conditionsMet = promotion.minSubtotal <= product.price && promotion.minQuantity <= 1

  const preview: ProductPromotionPreview = {
    promotionId: promotion.id,
    name: promotion.name,
    kind: resolveKind(promotion),
    badge: resolveBadge(promotion),
    originalPrice: product.price,
    estimatedUnitPrice: resolveEstimatedUnitPrice(promotion, product.price, conditionsMet),
    discountValue: promotion.discountValue,
    maxDiscount: promotion.maxDiscount,
    minSubtotal: promotion.minSubtotal,
    minQuantity: promotion.minQuantity,
    conditionsMet,
    promotionCount: 0,
    endsAt: promotion.endDate,
  }

  return {
    preview,
    score: resolveScore(promotion, product.price),
    priority: promotion.priority,
  }
}

const compareScoredPreviews = (left: ScoredPreview, right: ScoredPreview): number => {
  if (right.score !== left.score) return right.score - left.score
  if (right.priority !== left.priority) return right.priority - left.priority
  const byEndDate =
    new Date(left.preview.endsAt).getTime() - new Date(right.preview.endsAt).getTime()
  if (byEndDate !== 0) return byEndDate
  return left.preview.promotionId.localeCompare(right.preview.promotionId)
}

const selectBestPreview = (scored: ScoredPreview[]): ScoredPreview | null => {
  if (scored.length === 0) return null

  const applicable = scored.filter((entry) => entry.preview.conditionsMet)
  const pool = applicable.length > 0 ? applicable : scored
  return [...pool].sort(compareScoredPreviews)[0] ?? null
}

export const resolveProductPromotionPreviews = (
  products: PublicProduct[],
  promotions: PublicPromotion[],
  branchId: string | null,
  now: Date,
): Map<string, ProductPreviewResult> => {
  const previewsByProduct = new Map<string, ProductPreviewResult>()

  for (const product of products) {
    const scored = promotions
      .filter((promotion) => isEligibleForProduct(promotion, product, branchId, now))
      .map((promotion) => buildScoredPreview(promotion, product))

    const promotionCount = scored.length
    const previews = scored.map((entry) => ({
      ...entry.preview,
      promotionCount,
    }))
    const best = selectBestPreview(scored)

    previewsByProduct.set(product.id, {
      promotion: best ? { ...best.preview, promotionCount } : null,
      promotions: previews,
      promotionCount,
    })
  }

  return previewsByProduct
}

const withPreview = (
  product: PublicProduct,
  previewsByProduct: Map<string, ProductPreviewResult>,
): PublicProduct => {
  const preview = previewsByProduct.get(product.id)
  return {
    ...product,
    promotion: preview?.promotion ?? null,
    promotions: preview?.promotions ?? [],
  }
}

const toCatalogItem = (
  promotion: PublicPromotion,
  productsById: Map<string, PublicProduct>,
  categoriesById: Map<string, PublicCategory>,
  previewsByProduct: Map<string, ProductPreviewResult>,
): PublicPromotionCatalogItem => ({
  id: promotion.id,
  name: promotion.name,
  description: promotion.description,
  type: promotion.type,
  scope: promotion.scope,
  kind: resolveKind(promotion),
  badge: resolveBadge(promotion),
  discountValue: promotion.discountValue,
  maxDiscount: promotion.maxDiscount,
  buyQuantity: promotion.buyQuantity,
  payQuantity: promotion.payQuantity,
  startDate: promotion.startDate,
  endDate: promotion.endDate,
  daysOfWeek: promotion.daysOfWeek,
  startTime: promotion.startTime,
  endTime: promotion.endTime,
  minSubtotal: promotion.minSubtotal,
  minQuantity: promotion.minQuantity,
  branchIds: promotion.branchIds,
  code: promotion.code,
  categoryIds: promotion.categoryIds,
  productIds: promotion.productIds,
  categories: promotion.categoryIds
    .map((categoryId) => categoriesById.get(categoryId))
    .filter((category): category is PublicCategory => category !== undefined),
  products:
    promotion.scope === PROMOTION_SCOPE.product
      ? promotion.productIds
          .map((productId) => productsById.get(productId))
          .filter((product): product is PublicProduct => product !== undefined)
          .map((product) => withPreview(product, previewsByProduct))
      : [],
})

export const resolvePromotionCatalog = (
  promotions: PublicPromotion[],
  products: PublicProduct[],
  categories: PublicCategory[],
  previewsByProduct: Map<string, ProductPreviewResult>,
): PublicPromotionCatalogItem[] => {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return promotions.map((promotion) =>
    toCatalogItem(promotion, productsById, categoriesById, previewsByProduct),
  )
}
