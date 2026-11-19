import {
  asBoolean,
  asNumber,
  asNumberList,
  asRecordList,
  asString,
  asStringList,
  idOf,
  nullableNumber,
  nullableString,
} from '../common/mappers'
import type { RawRecord } from '../common/mappers'
import { orderStatusFromRest } from '../common/order-status.enum'
import { promotionScopeFromRest } from '../common/promotion-scope.enum'
import { promotionTypeFromRest } from '../common/promotion-type.enum'
import { mapBranch, mapCategory, mapProduct } from './commerce.types'
import {
  HomeFeed,
  NearbyBranch,
  ProductRecommendation,
  PromotionSummary,
  ReorderCard,
  ReorderItem,
  RecommendationReason,
} from './home-feed.types'

const REASONS: Record<string, RecommendationReason> = {
  REPEAT: RecommendationReason.REPEAT,
  FAVORITE_CATEGORY: RecommendationReason.FAVORITE_CATEGORY,
  DISCOVERY: RecommendationReason.DISCOVERY,
  POPULAR: RecommendationReason.POPULAR,
}

const mapReason = (value: unknown): RecommendationReason =>
  REASONS[asString(value).toUpperCase()] ?? RecommendationReason.DISCOVERY

export const mapProductRecommendation = (raw: RawRecord): ProductRecommendation => ({
  product: mapProduct((raw.product as RawRecord | undefined) ?? {}),
  reason: mapReason(raw.reason),
  hint: nullableString(raw.hint),
  score: asNumber(raw.score),
})

export const mapNearbyBranch = (raw: RawRecord): NearbyBranch => ({
  branch: mapBranch((raw.branch as RawRecord | undefined) ?? {}),
  distanceMeters: asNumber(raw.distanceMeters),
})

export const mapPromotionSummary = (raw: RawRecord): PromotionSummary => ({
  id: idOf(raw),
  name: asString(raw.name),
  description: nullableString(raw.description),
  startDate: asString(raw.startDate),
  endDate: asString(raw.endDate),
  type: promotionTypeFromRest(nullableString(raw.type)),
  discountValue: nullableNumber(raw.discountValue),
  maxDiscount: nullableNumber(raw.maxDiscount),
  buyQuantity: nullableNumber(raw.buyQuantity),
  payQuantity: nullableNumber(raw.payQuantity),
  scope: promotionScopeFromRest(nullableString(raw.scope)),
  categoryIds: asStringList(raw.categoryIds),
  productIds: asStringList(raw.productIds),
  branchIds: asStringList(raw.branchIds),
  minSubtotal: asNumber(raw.minSubtotal),
  minQuantity: asNumber(raw.minQuantity),
  daysOfWeek: asNumberList(raw.daysOfWeek),
  startTime: nullableString(raw.startTime),
  endTime: nullableString(raw.endTime),
})

export const mapReorderItem = (raw: RawRecord): ReorderItem => ({
  productId: asString(raw.productId),
  name: asString(raw.name),
  quantity: asNumber(raw.quantity),
})

export const mapReorderCard = (raw: RawRecord): ReorderCard => ({
  id: idOf(raw),
  number: asString(raw.number),
  status: orderStatusFromRest(asString(raw.status)),
  createdAt: asString(raw.createdAt),
  total: asNumber(raw.total),
  branchId: asString(raw.branchId),
  branch: raw.branch ? mapBranch(raw.branch as RawRecord) : null,
  items: asRecordList(raw.items).map(mapReorderItem),
})

export const mapHomeFeed = (raw: RawRecord): HomeFeed => ({
  generatedAt: asString(raw.generatedAt),
  hasHistory: asBoolean(raw.hasHistory),
  topCategory: raw.topCategory ? mapCategory(raw.topCategory as RawRecord) : null,
  favoriteBranch: raw.favoriteBranch ? mapBranch(raw.favoriteBranch as RawRecord) : null,
  nearestBranch: raw.nearestBranch ? mapNearbyBranch(raw.nearestBranch as RawRecord) : null,
  categories: asRecordList(raw.categories).map(mapCategory),
  forYou: asRecordList(raw.forYou).map(mapProductRecommendation),
  discovery: asRecordList(raw.discovery).map(mapProductRecommendation),
  reorder: asRecordList(raw.reorder).map(mapReorderCard),
  promotions: asRecordList(raw.promotions).map(mapPromotionSummary),
})
