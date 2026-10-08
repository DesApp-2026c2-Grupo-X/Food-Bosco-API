import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { assertConfigGroupCoherent } from './config-group.rules'
import {
  OPTION_NOT_FOUND,
  ProductDocument,
  PublicConfigGroup,
  PublicConfigOption,
  PublicProduct,
  RecipeItem,
  serializeGroup,
  serializeOption,
  serializeProduct,
} from './product.model'
import {
  CreateConfigGroupData,
  CreateConfigOptionData,
  CreateProductData,
  ProductListQuery,
  ProductRepository,
  RecipeItemData,
  UpdateConfigGroupData,
  UpdateConfigOptionData,
  UpdateProductData,
} from './product.repository'

export interface ProductListResponse {
  data: PublicProduct[]
  meta: { total: number; limit: number; offset: number }
}

const toRecipeItemData = (item: RecipeItem): RecipeItemData => ({
  ingredientId: item.ingredientId,
  quantity: item.quantity,
  optionAdjustments: (item.optionAdjustments ?? []).map((adjustment) => ({
    optionId: adjustment.optionId,
    quantity: adjustment.quantity,
  })),
})

const mergeAdjustments = (
  current: RecipeItemData['optionAdjustments'],
  incoming: RecipeItemData['optionAdjustments'],
): NonNullable<RecipeItemData['optionAdjustments']> => {
  const merged = new Map<string, number>()
  for (const adjustment of [...(current ?? []), ...(incoming ?? [])]) {
    merged.set(adjustment.optionId, (merged.get(adjustment.optionId) ?? 0) + adjustment.quantity)
  }
  return [...merged].map(([optionId, quantity]) => ({ optionId, quantity }))
}

/**
 * RQ-CAT-11: la receta no debe contener el mismo ingrediente dos veces. Se fusionan
 * las cantidades del ingrediente repetido (y sus ajustes por opción) conservando el
 * orden de la primera aparición.
 */
const mergeRecipeItems = (items: RecipeItemData[]): RecipeItemData[] => {
  const merged = new Map<string, RecipeItemData>()
  for (const item of items) {
    const existing = merged.get(item.ingredientId)
    if (!existing) {
      merged.set(item.ingredientId, {
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        optionAdjustments: [...(item.optionAdjustments ?? [])],
      })
      continue
    }
    existing.quantity += item.quantity
    existing.optionAdjustments = mergeAdjustments(
      existing.optionAdjustments,
      item.optionAdjustments,
    )
  }
  return [...merged.values()]
}

@Injectable()
export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  async list(query: ProductListQuery): Promise<ProductListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeProduct),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicProduct | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeProduct(doc) : null
  }

  async findByIds(ids: string[]): Promise<PublicProduct[]> {
    const docs = await this.repository.findByIds(ids)
    return docs.map(serializeProduct)
  }

  async findAll(): Promise<PublicProduct[]> {
    const docs = await this.repository.findAll()
    return docs.map(serializeProduct)
  }

  async isIngredientInUse(ingredientId: string): Promise<boolean> {
    const count = await this.repository.countActiveUsingIngredient(ingredientId)
    return count > 0
  }

  async create(data: CreateProductData): Promise<PublicProduct> {
    const doc = await this.repository.create(data)
    return serializeProduct(doc)
  }

  async update(id: string, patch: UpdateProductData): Promise<PublicProduct | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializeProduct(doc) : null
  }

  async setAvailable(id: string, available: boolean): Promise<PublicProduct | null> {
    const doc = await this.repository.setAvailable(id, available)
    return doc ? serializeProduct(doc) : null
  }

  async addConfigGroup(
    productId: string,
    data: CreateConfigGroupData,
  ): Promise<PublicConfigGroup | null> {
    assertConfigGroupCoherent(data)
    const group = await this.repository.addConfigGroup(productId, data)
    return group ? serializeGroup(group) : null
  }

  async updateConfigGroup(
    productId: string,
    groupId: string,
    patch: UpdateConfigGroupData,
  ): Promise<PublicConfigGroup | null> {
    const current = await this.repository.findConfigGroup(productId, groupId)
    if (!current) return null
    assertConfigGroupCoherent({
      required: patch.required ?? current.required,
      min: patch.min !== undefined ? patch.min : current.min,
      max: patch.max !== undefined ? patch.max : current.max,
    })
    const group = await this.repository.updateConfigGroup(productId, groupId, patch)
    return group ? serializeGroup(group) : null
  }

  async removeConfigGroup(productId: string, groupId: string): Promise<boolean> {
    return this.repository.removeConfigGroup(productId, groupId)
  }

  async addConfigOption(
    productId: string,
    groupId: string,
    data: CreateConfigOptionData,
  ): Promise<PublicConfigOption | null> {
    this.assertNonNegativeExtraPrice(data.extraPrice)
    const option = await this.repository.addConfigOption(productId, groupId, data)
    return option ? serializeOption(option) : null
  }

  async updateConfigOption(
    productId: string,
    groupId: string,
    optionId: string,
    patch: UpdateConfigOptionData,
  ): Promise<PublicConfigOption | null> {
    this.assertNonNegativeExtraPrice(patch.extraPrice)
    const option = await this.repository.updateConfigOption(productId, groupId, optionId, patch)
    return option ? serializeOption(option) : null
  }

  async removeConfigOption(productId: string, groupId: string, optionId: string): Promise<boolean> {
    return this.repository.removeConfigOption(productId, groupId, optionId)
  }

  async setRecipe(productId: string, items: RecipeItemData[]): Promise<PublicProduct | null> {
    this.assertRecipeQuantities(items)
    const current = await this.repository.findById(productId)
    if (!current) return null
    const normalized = mergeRecipeItems(items)
    this.assertRecipeOptionAdjustments(current, normalized)
    const doc = await this.repository.setRecipe(productId, normalized)
    return doc ? serializeProduct(doc) : null
  }

  async addRecipeItem(productId: string, item: RecipeItemData): Promise<PublicProduct | null> {
    this.assertRecipeQuantities([item])
    const current = await this.repository.findById(productId)
    if (!current) return null
    this.assertRecipeOptionAdjustments(current, [item])
    const existing = current.recipe.find((entry) => entry.ingredientId === item.ingredientId)
    if (existing?._id) {
      const merged = mergeRecipeItems([toRecipeItemData(existing), item])[0]
      const doc = await this.repository.updateRecipeItem(productId, existing._id.toString(), merged)
      return doc ? serializeProduct(doc) : null
    }
    const doc = await this.repository.addRecipeItem(productId, item)
    return doc ? serializeProduct(doc) : null
  }

  async updateRecipeItem(
    productId: string,
    itemId: string,
    patch: RecipeItemData,
  ): Promise<PublicProduct | null> {
    this.assertRecipeQuantities([patch])
    const current = await this.repository.findById(productId)
    if (!current) return null
    const target = current.recipe.find((entry) => entry._id?.toString() === itemId)
    if (!target) return null
    this.assertRecipeOptionAdjustments(current, [patch])

    // RQ-CAT-11: si el patch reasigna el ítem a un ingrediente ya presente, se fusionan
    // ambos (cantidades y ajustes) conservando el id editado y eliminando el duplicado.
    const duplicate = current.recipe.find(
      (entry) => entry._id?.toString() !== itemId && entry.ingredientId === patch.ingredientId,
    )
    if (!duplicate?._id) {
      const doc = await this.repository.updateRecipeItem(productId, itemId, patch)
      return doc ? serializeProduct(doc) : null
    }

    const merged = mergeRecipeItems([patch, toRecipeItemData(duplicate)])[0]
    const updated = await this.repository.updateRecipeItem(productId, itemId, merged)
    if (!updated) return null
    const doc = await this.repository.removeRecipeItem(productId, duplicate._id.toString())
    return doc ? serializeProduct(doc) : null
  }

  async removeRecipeItem(productId: string, itemId: string): Promise<PublicProduct | null> {
    const doc = await this.repository.removeRecipeItem(productId, itemId)
    return doc ? serializeProduct(doc) : null
  }

  private assertNonNegativeExtraPrice(extraPrice?: number): void {
    if (extraPrice !== undefined && extraPrice < 0) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'El precio extra de la opción no puede ser negativo',
        400,
      )
    }
  }

  private assertRecipeOptionAdjustments(product: ProductDocument, items: RecipeItemData[]): void {
    const optionIds = new Set(
      product.configGroups.flatMap((group) =>
        (group.options ?? [])
          .map((option) => option._id?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const hasUnknownOption = items.some((item) =>
      (item.optionAdjustments ?? []).some((adjustment) => !optionIds.has(adjustment.optionId)),
    )
    if (hasUnknownOption) {
      throw new DomainException(
        OPTION_NOT_FOUND,
        'Una opción de configuración de la receta no existe para el producto',
        404,
      )
    }
  }

  private assertRecipeQuantities(items: RecipeItemData[]): void {
    const hasInvalidQuantity = items.some(
      (item) =>
        !(item.quantity > 0) ||
        (item.optionAdjustments ?? []).some((adjustment) => !(adjustment.quantity > 0)),
    )
    if (hasInvalidQuantity) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'La cantidad de un ingrediente de la receta debe ser mayor a 0',
        400,
      )
    }
  }
}
