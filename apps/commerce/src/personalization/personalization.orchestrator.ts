import { Injectable } from '@nestjs/common'
import type { PublicBranch } from '../branch/branch.model'
import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicOrder } from '../order/order.model'
import { OrderService } from '../order/order.service'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import type { HomeFeed, ReorderCard } from './personalization.model'
import type { HomeFeedQueryDto } from './dto/home-feed-query.dto'
import {
  PERSONALIZATION_CONSTANTS,
  buildTasteProfile,
  rankDiscovery,
  rankForYou,
  rankPromotions,
  selectReorderOrders,
  sortCategories,
} from './ranking'

const resolveLimit = (value: number | undefined, fallback: number, max: number): number => {
  if (value === undefined) return fallback
  return Math.min(Math.max(Math.trunc(value), 1), max)
}

const resolveCoordinates = (
  query: HomeFeedQueryDto,
): { latitude: number; longitude: number } | null => {
  const hasLatitude = query.lat !== undefined
  const hasLongitude = query.lng !== undefined

  if (hasLatitude !== hasLongitude) {
    throw new DomainException(
      ERROR_CODES.validationError,
      'Las coordenadas deben informarse juntas (lat y lng)',
      400,
    )
  }

  return hasLatitude && hasLongitude
    ? { latitude: query.lat as number, longitude: query.lng as number }
    : null
}

@Injectable()
export class PersonalizationOrchestrator {
  constructor(
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly branchService: BranchService,
    private readonly promotionService: PromotionService,
  ) {}

  async getHomeFeed(auth: AuthContext, query: HomeFeedQueryDto): Promise<HomeFeed> {
    const now = new Date()
    const coordinates = resolveCoordinates(query)
    const forYouLimit = resolveLimit(
      query.forYouLimit,
      PERSONALIZATION_CONSTANTS.forYou.default,
      PERSONALIZATION_CONSTANTS.forYou.max,
    )
    const discoveryLimit = resolveLimit(
      query.discoveryLimit,
      PERSONALIZATION_CONSTANTS.discovery.default,
      PERSONALIZATION_CONSTANTS.discovery.max,
    )
    const reorderLimit = resolveLimit(
      query.reorderLimit,
      PERSONALIZATION_CONSTANTS.reorder.default,
      PERSONALIZATION_CONSTANTS.reorder.max,
    )

    const [orders, products, categories, promotions, nearest] = await Promise.all([
      auth.userId
        ? this.orderService.listRecentDeliveredByClient(
            auth.userId,
            PERSONALIZATION_CONSTANTS.historyMaxOrders,
          )
        : Promise.resolve([]),
      this.productService.findAll(),
      this.categoryService.listActive(),
      this.promotionService.getActiveForHome(now),
      coordinates
        ? this.branchService.findNearestAvailable(coordinates.latitude, coordinates.longitude)
        : Promise.resolve(null),
    ])

    const profile = buildTasteProfile(orders, products, now)
    const discovery = rankDiscovery(profile, products, new Set(), discoveryLimit)
    const discoveryProductIds = new Set(discovery.map((entry) => entry.product.id))
    const forYou = rankForYou(profile, products, forYouLimit, discoveryProductIds)
    const reorderOrders = selectReorderOrders(profile.windowOrders, reorderLimit)

    const branchIds = [
      ...new Set([
        ...reorderOrders.map((order) => order.branchId),
        ...(profile.favoriteBranchId ? [profile.favoriteBranchId] : []),
      ]),
    ]
    const branches = await Promise.all(
      branchIds.map((branchId) => this.branchService.findById(branchId)),
    )
    const branchesById = new Map<string, PublicBranch>(
      branches
        .filter((branch): branch is PublicBranch => branch !== null)
        .map((branch) => [branch.id, branch]),
    )

    return {
      generatedAt: now.toISOString(),
      hasHistory: profile.hasHistory,
      topCategory: categories.find((category) => category.id === profile.topCategoryIds[0]) ?? null,
      favoriteBranch: profile.favoriteBranchId
        ? (branchesById.get(profile.favoriteBranchId) ?? null)
        : null,
      nearestBranch: nearest
        ? {
            branch: nearest.branch,
            distanceMeters: Math.round(nearest.distanceKm * 1000),
          }
        : null,
      categories: sortCategories(categories, profile),
      forYou,
      discovery,
      reorder: reorderOrders.map((order) => this.toReorderCard(order, branchesById)),
      promotions: rankPromotions(promotions, profile, PERSONALIZATION_CONSTANTS.promotionLimit),
    }
  }

  private toReorderCard(order: PublicOrder, branchesById: Map<string, PublicBranch>): ReorderCard {
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      branchId: order.branchId,
      branch: branchesById.get(order.branchId) ?? null,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
      })),
    }
  }
}
