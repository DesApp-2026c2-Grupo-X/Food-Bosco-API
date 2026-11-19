import { Injectable } from '@nestjs/common'
import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { ERROR_CODES, PROMOTION_SCOPE } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { ProductService } from '../product/product.service'
import { PublicPromotion } from './promotion.model'
import { CreatePromotionData, UpdatePromotionData } from './promotion.repository'
import { PromotionService } from './promotion.service'

@Injectable()
export class PromotionOrchestrator {
  constructor(
    private readonly promotionService: PromotionService,
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
  ) {}

  private async assertReferences(data: CreatePromotionData | UpdatePromotionData): Promise<void> {
    if (data.categoryIds && data.categoryIds.length > 0) {
      for (const catId of data.categoryIds) {
        const cat = await this.categoryService.findById(catId)
        if (!cat) {
          throw new DomainException(
            ERROR_CODES.promotionReferenceNotFound,
            `La categoría con id ${catId} no existe`,
            400,
          )
        }
      }
    }

    if (data.productIds && data.productIds.length > 0) {
      const products = await this.productService.findByIds(data.productIds)
      if (products.length !== data.productIds.length) {
        throw new DomainException(
          ERROR_CODES.promotionReferenceNotFound,
          'Uno o más productos especificados no existen',
          400,
        )
      }
    }

    if (data.branchIds && data.branchIds.length > 0) {
      for (const branchId of data.branchIds) {
        const branch = await this.branchService.findById(branchId)
        if (!branch) {
          throw new DomainException(
            ERROR_CODES.promotionReferenceNotFound,
            `La sucursal con id ${branchId} no existe`,
            400,
          )
        }
      }
    }
  }

  private normalizePayload<T extends CreatePromotionData | UpdatePromotionData>(data: T): T {
    const copy = { ...data }
    if (copy.scope === PROMOTION_SCOPE.order) {
      copy.categoryIds = []
      copy.productIds = []
    } else if (copy.scope === PROMOTION_SCOPE.category) {
      copy.productIds = []
    } else if (copy.scope === PROMOTION_SCOPE.product) {
      copy.categoryIds = []
    }
    return copy
  }

  async create(data: CreatePromotionData): Promise<PublicPromotion> {
    const normalized = this.normalizePayload(data)
    await this.assertReferences(normalized)
    return this.promotionService.create(normalized)
  }

  async update(id: string, patch: UpdatePromotionData): Promise<PublicPromotion | null> {
    const normalized = this.normalizePayload(patch)
    await this.assertReferences(normalized)
    return this.promotionService.update(id, normalized)
  }
}
