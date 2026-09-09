import { Injectable } from '@nestjs/common'
import {
  PublicConfigGroup,
  PublicConfigOption,
  PublicProduct,
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
    const group = await this.repository.addConfigGroup(productId, data)
    return group ? serializeGroup(group) : null
  }

  async updateConfigGroup(
    productId: string,
    groupId: string,
    patch: UpdateConfigGroupData,
  ): Promise<PublicConfigGroup | null> {
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
    const option = await this.repository.addConfigOption(productId, groupId, data)
    return option ? serializeOption(option) : null
  }

  async updateConfigOption(
    productId: string,
    groupId: string,
    optionId: string,
    patch: UpdateConfigOptionData,
  ): Promise<PublicConfigOption | null> {
    const option = await this.repository.updateConfigOption(productId, groupId, optionId, patch)
    return option ? serializeOption(option) : null
  }

  async removeConfigOption(productId: string, groupId: string, optionId: string): Promise<boolean> {
    return this.repository.removeConfigOption(productId, groupId, optionId)
  }

  async setRecipe(productId: string, items: RecipeItemData[]): Promise<PublicProduct | null> {
    const doc = await this.repository.setRecipe(productId, items)
    return doc ? serializeProduct(doc) : null
  }

  async addRecipeItem(productId: string, item: RecipeItemData): Promise<PublicProduct | null> {
    const doc = await this.repository.addRecipeItem(productId, item)
    return doc ? serializeProduct(doc) : null
  }

  async updateRecipeItem(
    productId: string,
    itemId: string,
    patch: RecipeItemData,
  ): Promise<PublicProduct | null> {
    const doc = await this.repository.updateRecipeItem(productId, itemId, patch)
    return doc ? serializeProduct(doc) : null
  }

  async removeRecipeItem(productId: string, itemId: string): Promise<PublicProduct | null> {
    const doc = await this.repository.removeRecipeItem(productId, itemId)
    return doc ? serializeProduct(doc) : null
  }
}
