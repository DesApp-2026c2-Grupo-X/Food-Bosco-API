import { Injectable } from '@nestjs/common'
import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { IngredientService } from '../ingredient/ingredient.service'
import { PromotionService } from '../promotion/promotion.service'
import {
  resolveProductPromotionPreviews,
  type ProductPreviewResult,
} from '../promotion/promotion.preview'
import type { PublicProduct } from './product.model'
import type {
  CreateProductData,
  ProductListQuery,
  RecipeItemData,
  UpdateProductData,
} from './product.repository'
import { ProductService } from './product.service'
import type { ProductListResponse } from './product.service'

interface CatalogCoordinates {
  lat?: number
  lng?: number
}

@Injectable()
export class ProductOrchestrator {
  constructor(
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly ingredientService: IngredientService,
    private readonly promotionService: PromotionService,
    private readonly branchService: BranchService,
  ) {}

  async listWithPreviews(
    query: ProductListQuery,
    coordinates?: CatalogCoordinates,
  ): Promise<ProductListResponse> {
    const result = await this.productService.list(query)
    const previews = await this.resolvePreviews(result.data, coordinates)
    return {
      ...result,
      data: result.data.map((product) => this.attachPreview(product, previews.get(product.id))),
    }
  }

  async findByIdWithPreviews(
    id: string,
    coordinates?: CatalogCoordinates,
  ): Promise<PublicProduct | null> {
    const product = await this.productService.findById(id)
    if (!product) return null

    const previews = await this.resolvePreviews([product], coordinates)
    return this.attachPreview(product, previews.get(product.id))
  }

  async create(data: CreateProductData): Promise<PublicProduct> {
    await this.assertCategoryExists(data.categoryId)
    return this.productService.create(data)
  }

  async update(id: string, patch: UpdateProductData): Promise<PublicProduct | null> {
    if (patch.categoryId !== undefined) {
      await this.assertCategoryExists(patch.categoryId)
    }
    return this.productService.update(id, patch)
  }

  async setRecipe(productId: string, items: RecipeItemData[]): Promise<PublicProduct | null> {
    await this.assertIngredientsExist(items.map((item) => item.ingredientId))
    return this.productService.setRecipe(productId, items)
  }

  async addRecipeItem(productId: string, item: RecipeItemData): Promise<PublicProduct | null> {
    await this.assertIngredientsExist([item.ingredientId])
    return this.productService.addRecipeItem(productId, item)
  }

  async updateRecipeItem(
    productId: string,
    itemId: string,
    patch: RecipeItemData,
  ): Promise<PublicProduct | null> {
    await this.assertIngredientsExist([patch.ingredientId])
    return this.productService.updateRecipeItem(productId, itemId, patch)
  }

  private attachPreview(
    product: PublicProduct,
    preview: ProductPreviewResult | undefined,
  ): PublicProduct {
    return {
      ...product,
      promotion: preview?.promotion ?? null,
      promotions: preview?.promotions ?? [],
    }
  }

  private async resolvePreviews(
    products: PublicProduct[],
    coordinates?: CatalogCoordinates,
  ): Promise<Map<string, ProductPreviewResult>> {
    const branchId = await this.resolveBranchId(coordinates)
    const now = new Date()
    const promotions = await this.promotionService.getCandidates({ branchId, now })
    return resolveProductPromotionPreviews(products, promotions, branchId, now)
  }

  private async resolveBranchId(coordinates?: CatalogCoordinates): Promise<string | null> {
    const lat = coordinates?.lat
    const lng = coordinates?.lng
    if ((lat === undefined) !== (lng === undefined)) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'Las coordenadas deben informarse juntas (lat y lng)',
        400,
      )
    }
    if (lat === undefined || lng === undefined) return null

    const branches = await this.branchService.findAvailable(lat, lng)
    return branches[0]?.id ?? null
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categoryService.findById(categoryId)
    if (!category) {
      throw new DomainException(ERROR_CODES.categoryNotFound, 'Categoría no encontrada', 404)
    }
  }

  private async assertIngredientsExist(ingredientIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(ingredientIds)]
    if (uniqueIds.length === 0) return

    const ingredients = await this.ingredientService.findByIds(uniqueIds)
    const foundIds = new Set(ingredients.map((ingredient) => ingredient.id))
    const missing = uniqueIds.find((id) => !foundIds.has(id))
    if (missing) {
      throw new DomainException(ERROR_CODES.ingredientNotFound, 'Ingrediente no encontrado', 404)
    }
  }
}
