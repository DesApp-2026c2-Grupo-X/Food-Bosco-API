import type { PublicBranch } from '../branch/branch.model'
import type { PublicCategory } from '../category/category.model'
import type { OrderStatus } from '../config/constants'
import type { PublicProduct } from '../product/product.model'
import type { PublicPromotion } from '../promotion/promotion.model'

export const RECOMMENDATION_REASON = {
  repeat: 'REPEAT',
  favoriteCategory: 'FAVORITE_CATEGORY',
  discovery: 'DISCOVERY',
  popular: 'POPULAR',
} as const

export type RecommendationReason =
  (typeof RECOMMENDATION_REASON)[keyof typeof RECOMMENDATION_REASON]

export interface ProductRecommendation {
  product: PublicProduct
  reason: RecommendationReason
  hint: string | null
  score: number
}

export interface NearbyBranch {
  branch: PublicBranch
  distanceMeters: number
}

export interface ReorderItem {
  productId: string
  name: string
  quantity: number
}

export interface ReorderCard {
  id: string
  number: string
  status: OrderStatus
  createdAt: string
  total: number
  branchId: string
  branch: PublicBranch | null
  items: ReorderItem[]
}

export interface HomeFeed {
  generatedAt: string
  hasHistory: boolean
  topCategory: PublicCategory | null
  favoriteBranch: PublicBranch | null
  nearestBranch: NearbyBranch | null
  categories: PublicCategory[]
  forYou: ProductRecommendation[]
  discovery: ProductRecommendation[]
  reorder: ReorderCard[]
  promotions: PublicPromotion[]
}
