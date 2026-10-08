import { Injectable } from '@nestjs/common'
import { CategoryService } from '../category/category.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { IngredientService } from '../ingredient/ingredient.service'
import type { PublicProduct } from './product.model'
import type { CreateProductData, RecipeItemData, UpdateProductData } from './product.repository'
import { ProductService } from './product.service'

@Injectable()
export class ProductOrchestrator {
  constructor(
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly ingredientService: IngredientService,
  ) {}

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
