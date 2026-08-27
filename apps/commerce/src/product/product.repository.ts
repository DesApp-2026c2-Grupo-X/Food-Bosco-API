import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { ConfigGroupType } from '../config/constants'
import { ConfigGroup, ConfigOption, Product, ProductDocument } from './product.model'

export interface CreateProductData {
  categoryId: string
  name: string
  description: string
  price: number
  image?: string
}

export interface UpdateProductData {
  categoryId?: string
  name?: string
  description?: string
  price?: number
  image?: string
}

export interface ProductListQuery {
  categoryId?: string
  search?: string
  available?: boolean
  limit: number
  offset: number
}

export interface CreateConfigGroupData {
  name: string
  type: ConfigGroupType
  required: boolean
  min?: number | null
  max?: number | null
}

export interface UpdateConfigGroupData {
  name?: string
  type?: ConfigGroupType
  required?: boolean
  min?: number | null
  max?: number | null
}

export interface CreateConfigOptionData {
  name: string
  extraPrice: number
  available?: boolean
}

export interface UpdateConfigOptionData {
  name?: string
  extraPrice?: number
  available?: boolean
}

export interface RecipeItemData {
  ingredientId: string
  quantity: number
  optionAdjustments?: { optionId: string; quantity: number }[]
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class ProductRepository {
  constructor(@InjectModel(Product.name) private readonly model: Model<ProductDocument>) {}

  findById(id: string): Promise<ProductDocument | null> {
    return this.model.findById(id).exec()
  }

  findByIds(ids: string[]): Promise<ProductDocument[]> {
    return this.model.find({ _id: { $in: ids } }).exec()
  }

  findAll(): Promise<ProductDocument[]> {
    return this.model.find().sort({ name: 1 }).exec()
  }

  create(data: CreateProductData): Promise<ProductDocument> {
    return this.model.create({
      ...data,
      image: data.image ?? null,
      available: true,
      configGroups: [],
      recipe: [],
    })
  }

  async list(query: ProductListQuery): Promise<{ data: ProductDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.categoryId) filter.categoryId = query.categoryId
    if (query.available !== undefined) filter.available = query.available
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i')

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdateProductData): Promise<ProductDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setAvailable(id: string, available: boolean): Promise<ProductDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { available } }, { new: true }).exec()
  }

  async addConfigGroup(
    productId: string,
    data: CreateConfigGroupData,
  ): Promise<ConfigGroup | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    doc.configGroups.push({ ...data, min: data.min ?? null, max: data.max ?? null, options: [] })
    await doc.save()
    return doc.configGroups[doc.configGroups.length - 1]
  }

  async updateConfigGroup(
    productId: string,
    groupId: string,
    patch: UpdateConfigGroupData,
  ): Promise<ConfigGroup | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    const group = doc.configGroups.find((entry) => entry._id?.toString() === groupId)
    if (!group) return null
    if (patch.name !== undefined) group.name = patch.name
    if (patch.type !== undefined) group.type = patch.type
    if (patch.required !== undefined) group.required = patch.required
    if (patch.min !== undefined) group.min = patch.min
    if (patch.max !== undefined) group.max = patch.max
    await doc.save()
    return group
  }

  async removeConfigGroup(productId: string, groupId: string): Promise<boolean> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return false
    const before = doc.configGroups.length
    doc.configGroups = doc.configGroups.filter((entry) => entry._id?.toString() !== groupId)
    if (doc.configGroups.length === before) return false
    await doc.save()
    return true
  }

  async addConfigOption(
    productId: string,
    groupId: string,
    data: CreateConfigOptionData,
  ): Promise<ConfigOption | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    const group = doc.configGroups.find((entry) => entry._id?.toString() === groupId)
    if (!group) return null
    group.options.push({ ...data, available: data.available ?? true })
    await doc.save()
    return group.options[group.options.length - 1]
  }

  async updateConfigOption(
    productId: string,
    groupId: string,
    optionId: string,
    patch: UpdateConfigOptionData,
  ): Promise<ConfigOption | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    const group = doc.configGroups.find((entry) => entry._id?.toString() === groupId)
    if (!group) return null
    const option = group.options.find((entry) => entry._id?.toString() === optionId)
    if (!option) return null
    if (patch.name !== undefined) option.name = patch.name
    if (patch.extraPrice !== undefined) option.extraPrice = patch.extraPrice
    if (patch.available !== undefined) option.available = patch.available
    await doc.save()
    return option
  }

  async removeConfigOption(
    productId: string,
    groupId: string,
    optionId: string,
  ): Promise<boolean> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return false
    const group = doc.configGroups.find((entry) => entry._id?.toString() === groupId)
    if (!group) return false
    const before = group.options.length
    group.options = group.options.filter((entry) => entry._id?.toString() !== optionId)
    if (group.options.length === before) return false
    await doc.save()
    return true
  }

  async setRecipe(productId: string, items: RecipeItemData[]): Promise<ProductDocument | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    doc.recipe = items.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      optionAdjustments: item.optionAdjustments ?? [],
    }))
    return doc.save()
  }

  async addRecipeItem(productId: string, item: RecipeItemData): Promise<ProductDocument | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    doc.recipe.push({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      optionAdjustments: item.optionAdjustments ?? [],
    })
    return doc.save()
  }

  async updateRecipeItem(
    productId: string,
    itemId: string,
    patch: RecipeItemData,
  ): Promise<ProductDocument | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    const item = doc.recipe.find((entry) => entry._id?.toString() === itemId)
    if (!item) return null
    item.ingredientId = patch.ingredientId
    item.quantity = patch.quantity
    item.optionAdjustments = patch.optionAdjustments ?? []
    return doc.save()
  }

  async removeRecipeItem(productId: string, itemId: string): Promise<ProductDocument | null> {
    const doc = await this.model.findById(productId).exec()
    if (!doc) return null
    doc.recipe = doc.recipe.filter((entry) => entry._id?.toString() !== itemId)
    return doc.save()
  }
}
