import { ORDER_STATUS } from '../config/constants'
import type { PublicCategory } from '../category/category.model'
import type { PublicOrder } from '../order/order.model'
import type { PublicProduct } from '../product/product.model'
import type { PublicPromotion } from '../promotion/promotion.model'
import type { ProductRecommendation, RecommendationReason } from './personalization.model'
import { RECOMMENDATION_REASON } from './personalization.model'

const DAY_MS = 24 * 60 * 60 * 1000

export const PERSONALIZATION_CONSTANTS = {
  historyWindowDays: 365,
  historyMaxOrders: 100,
  halfLifeDays: 45,
  maxPerCategory: 2,
  forYou: { default: 8, max: 12 },
  discovery: { default: 4, max: 8 },
  reorder: { default: 3, max: 5 },
  promotionLimit: 20,
} as const

const HINTS: Record<RecommendationReason, string> = {
  REPEAT: 'Ya lo pediste',
  FAVORITE_CATEGORY: 'De tus favoritos',
  DISCOVERY: 'Nuevo para vos',
  POPULAR: 'Popular',
}

export interface TasteProfile {
  hasHistory: boolean
  windowOrders: PublicOrder[]
  productScore: Map<string, number>
  categoryScore: Map<string, number>
  branchScore: Map<string, number>
  purchasedProductIds: Set<string>
  topCategoryIds: string[]
  favoriteBranchId: string | null
}

const emptyProfile = (): TasteProfile => ({
  hasHistory: false,
  windowOrders: [],
  productScore: new Map(),
  categoryScore: new Map(),
  branchScore: new Map(),
  purchasedProductIds: new Set(),
  topCategoryIds: [],
  favoriteBranchId: null,
})

export const deliveredAtOf = (order: PublicOrder): Date => {
  const delivered = [...order.statusHistory]
    .reverse()
    .find((entry) => entry.newStatus === ORDER_STATUS.delivered)
  return delivered ? new Date(delivered.changedAt) : new Date(order.createdAt)
}

export const recencyWeight = (deliveredAt: Date, now: Date): number => {
  const days = Math.max(0, (now.getTime() - deliveredAt.getTime()) / DAY_MS)
  return 0.5 ** (days / PERSONALIZATION_CONSTANTS.halfLifeDays)
}

const rankOf = (scores: Map<string, number>, top: number): string[] =>
  [...scores.entries()]
    .sort(([leftId, leftScore], [rightId, rightScore]) =>
      rightScore === leftScore ? leftId.localeCompare(rightId) : rightScore - leftScore,
    )
    .slice(0, top)
    .map(([id]) => id)

export const buildTasteProfile = (
  orders: PublicOrder[],
  products: PublicProduct[],
  now: Date = new Date(),
): TasteProfile => {
  const from = new Date(now.getTime() - PERSONALIZATION_CONSTANTS.historyWindowDays * DAY_MS)
  const productsById = new Map(products.map((product) => [product.id, product]))

  const windowOrders = orders
    .filter((order) => order.status === ORDER_STATUS.delivered)
    .map((order) => ({ order, deliveredAt: deliveredAtOf(order) }))
    .filter((entry) => entry.deliveredAt >= from && entry.deliveredAt <= now)
    .sort((left, right) => right.deliveredAt.getTime() - left.deliveredAt.getTime())

  if (windowOrders.length === 0) {
    return emptyProfile()
  }

  const profile = emptyProfile()
  profile.hasHistory = true
  profile.windowOrders = windowOrders.map((entry) => entry.order)

  for (const { order, deliveredAt } of windowOrders) {
    const weight = recencyWeight(deliveredAt, now)
    profile.branchScore.set(order.branchId, (profile.branchScore.get(order.branchId) ?? 0) + weight)

    for (const item of order.items) {
      const quantity = Math.max(0, item.quantity)
      profile.purchasedProductIds.add(item.productId)
      profile.productScore.set(
        item.productId,
        (profile.productScore.get(item.productId) ?? 0) + quantity * weight,
      )

      const product = productsById.get(item.productId)
      if (product) {
        profile.categoryScore.set(
          product.categoryId,
          (profile.categoryScore.get(product.categoryId) ?? 0) + quantity * weight,
        )
      }
    }
  }

  profile.topCategoryIds = rankOf(profile.categoryScore, 3)
  profile.favoriteBranchId = rankOf(profile.branchScore, 1)[0] ?? null
  return profile
}

const maxValue = (scores: Map<string, number>): number =>
  [...scores.values()].reduce((max, value) => Math.max(max, value), 0)

const normalize = (value: number, max: number): number => (max > 0 ? value / max : 0)

const roundScore = (value: number): number => Math.round(value * 10_000) / 10_000

const compareCandidates = (
  left: { product: PublicProduct; score: number },
  right: { product: PublicProduct; score: number },
): number => {
  if (right.score !== left.score) return right.score - left.score
  const byName = left.product.name.localeCompare(right.product.name)
  return byName !== 0 ? byName : left.product.id.localeCompare(right.product.id)
}

const takeWithDiversity = <T>(
  candidates: T[],
  limit: number,
  categoryOf: (item: T) => string,
): T[] => {
  if (limit <= 0) return []

  const primary: T[] = []
  const overflow: T[] = []
  const perCategory = new Map<string, number>()

  for (const candidate of candidates) {
    const categoryId = categoryOf(candidate)
    const count = perCategory.get(categoryId) ?? 0
    if (count < PERSONALIZATION_CONSTANTS.maxPerCategory) {
      primary.push(candidate)
      perCategory.set(categoryId, count + 1)
    } else {
      overflow.push(candidate)
    }
  }

  return [...primary, ...overflow].slice(0, limit)
}

const scoreForProduct = (
  product: PublicProduct,
  profile: TasteProfile,
  productMax: number,
  categoryMax: number,
): number => {
  const productScore = normalize(profile.productScore.get(product.id) ?? 0, productMax)
  const categoryScore = normalize(profile.categoryScore.get(product.categoryId) ?? 0, categoryMax)
  const repeated = profile.purchasedProductIds.has(product.id) ? 2 : 0
  const topCategory = profile.topCategoryIds.includes(product.categoryId) ? 1 : 0
  return roundScore(3 * productScore + 1.5 * categoryScore + repeated + topCategory)
}

const reasonFor = (product: PublicProduct, profile: TasteProfile): RecommendationReason => {
  if (profile.purchasedProductIds.has(product.id)) return RECOMMENDATION_REASON.repeat
  if (profile.categoryScore.has(product.categoryId)) return RECOMMENDATION_REASON.favoriteCategory
  return RECOMMENDATION_REASON.discovery
}

const toRecommendation = (
  candidate: { product: PublicProduct; score: number },
  reason: RecommendationReason,
): ProductRecommendation => ({
  product: candidate.product,
  reason,
  hint: HINTS[reason],
  score: candidate.score,
})

export const rankForYou = (
  profile: TasteProfile,
  products: PublicProduct[],
  limit: number,
  excludedProductIds: ReadonlySet<string> = new Set(),
): ProductRecommendation[] => {
  if (!profile.hasHistory || limit <= 0) return []

  const productMax = maxValue(profile.productScore)
  const categoryMax = maxValue(profile.categoryScore)
  const toCandidate = (product: PublicProduct) => ({
    product,
    score: scoreForProduct(product, profile, productMax, categoryMax),
  })

  const available = products
    .filter((product) => product.available)
    .filter((product) => !excludedProductIds.has(product.id))

  // "Para vos" prioriza categorías con historial; las nuevas se usan sólo para
  // completar slots, de modo que "Descubrí algo nuevo" conserve su contenido.
  const known = available
    .filter((product) => profile.categoryScore.has(product.categoryId))
    .map(toCandidate)
    .sort(compareCandidates)

  const undiscovered = available
    .filter((product) => !profile.categoryScore.has(product.categoryId))
    .map(toCandidate)
    .sort(compareCandidates)

  const selected = takeWithDiversity(known, limit, (candidate) => candidate.product.categoryId)

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map((candidate) => candidate.product.id))
    selected.push(
      ...takeWithDiversity(
        undiscovered.filter((candidate) => !selectedIds.has(candidate.product.id)),
        limit - selected.length,
        (candidate) => candidate.product.categoryId,
      ),
    )
  }

  return selected.map((candidate) =>
    toRecommendation(candidate, reasonFor(candidate.product, profile)),
  )
}

export const rankDiscovery = (
  profile: TasteProfile,
  products: PublicProduct[],
  shownProductIds: ReadonlySet<string>,
  limit: number,
): ProductRecommendation[] => {
  if (!profile.hasHistory || limit <= 0) return []

  const available = products
    .filter((product) => product.available)
    .filter((product) => !profile.purchasedProductIds.has(product.id))
    .filter((product) => !shownProductIds.has(product.id))

  const productMax = maxValue(profile.productScore)
  const categoryMax = maxValue(profile.categoryScore)
  const toCandidate = (product: PublicProduct) => ({
    product,
    score: scoreForProduct(product, profile, productMax, categoryMax),
  })

  const undiscovered = available
    .filter((product) => !profile.categoryScore.has(product.categoryId))
    .map(toCandidate)
    .sort(compareCandidates)

  const known = available
    .filter((product) => profile.categoryScore.has(product.categoryId))
    .map(toCandidate)
    .sort(compareCandidates)

  const primary = takeWithDiversity(
    undiscovered,
    limit,
    (candidate) => candidate.product.categoryId,
  ).map((candidate) => toRecommendation(candidate, RECOMMENDATION_REASON.discovery))

  if (primary.length >= limit) {
    return primary
  }

  const fallback = takeWithDiversity(
    known,
    limit - primary.length,
    (candidate) => candidate.product.categoryId,
  ).map((candidate) => toRecommendation(candidate, RECOMMENDATION_REASON.favoriteCategory))

  return [...primary, ...fallback]
}

const reorderSignature = (order: PublicOrder): string =>
  `${order.branchId}:${order.items
    .map((item) => item.productId)
    .sort()
    .join(',')}`

export const selectReorderOrders = (orders: PublicOrder[], limit: number): PublicOrder[] => {
  if (limit <= 0) return []

  const seen = new Set<string>()
  const selected: PublicOrder[] = []

  for (const order of orders) {
    if (order.items.length === 0) continue
    const signature = reorderSignature(order)
    if (seen.has(signature)) continue

    seen.add(signature)
    selected.push(order)
    if (selected.length >= limit) break
  }

  return selected
}

export const sortCategories = (
  categories: PublicCategory[],
  profile: TasteProfile,
): PublicCategory[] =>
  [...categories].sort((left, right) => {
    const leftScore = profile.categoryScore.get(left.id) ?? 0
    const rightScore = profile.categoryScore.get(right.id) ?? 0
    return rightScore === leftScore ? left.name.localeCompare(right.name) : rightScore - leftScore
  })

const promotionAffinity = (promotion: PublicPromotion, profile: TasteProfile): number => {
  const byProduct = promotion.productIds.some((id) => profile.productScore.has(id)) ? 2 : 0
  const byCategory = promotion.categoryIds.some((id) => profile.categoryScore.has(id)) ? 1.5 : 0
  const byBranch =
    profile.favoriteBranchId && promotion.branchIds.includes(profile.favoriteBranchId) ? 1 : 0
  return byProduct + byCategory + byBranch
}

export const rankPromotions = (
  promotions: PublicPromotion[],
  profile: TasteProfile,
  limit: number,
): PublicPromotion[] =>
  [...promotions]
    .sort((left, right) => {
      const affinityDifference =
        promotionAffinity(right, profile) - promotionAffinity(left, profile)
      if (affinityDifference !== 0) return affinityDifference
      if (right.priority !== left.priority) return right.priority - left.priority
      return right.startDate.localeCompare(left.startDate)
    })
    .slice(0, Math.max(0, limit))
