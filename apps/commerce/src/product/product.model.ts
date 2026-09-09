import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { CONFIG_GROUP_TYPE_VALUES } from '../config/constants'
import type { ConfigGroupType } from '../config/constants'

@Schema()
export class ConfigOption {
  readonly _id?: Types.ObjectId

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true })
  extraPrice!: number

  @Prop({ default: true })
  available!: boolean
}

export const ConfigOptionSchema = SchemaFactory.createForClass(ConfigOption)

@Schema()
export class ConfigGroup {
  readonly _id?: Types.ObjectId

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, enum: CONFIG_GROUP_TYPE_VALUES, type: String })
  type!: ConfigGroupType

  @Prop({ required: true })
  required!: boolean

  @Prop({ default: null, type: Number })
  min!: number | null

  @Prop({ default: null, type: Number })
  max!: number | null

  @Prop({ type: [ConfigOptionSchema], default: [] })
  options!: ConfigOption[]
}

export const ConfigGroupSchema = SchemaFactory.createForClass(ConfigGroup)

@Schema({ _id: false })
export class RecipeOptionAdjustment {
  @Prop({ required: true })
  optionId!: string

  @Prop({ required: true })
  quantity!: number
}

export const RecipeOptionAdjustmentSchema = SchemaFactory.createForClass(RecipeOptionAdjustment)

@Schema()
export class RecipeItem {
  readonly _id?: Types.ObjectId

  @Prop({ required: true })
  ingredientId!: string

  @Prop({ required: true })
  quantity!: number

  @Prop({ type: [RecipeOptionAdjustmentSchema], default: [] })
  optionAdjustments!: RecipeOptionAdjustment[]
}

export const RecipeItemSchema = SchemaFactory.createForClass(RecipeItem)

@Schema({ collection: 'products', timestamps: { createdAt: true, updatedAt: true } })
export class Product {
  @Prop({ required: true, index: true })
  categoryId!: string

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, trim: true })
  description!: string

  @Prop({ required: true })
  price!: number

  @Prop({ default: null, type: String })
  image!: string | null

  @Prop({ default: true })
  available!: boolean

  @Prop({ type: [ConfigGroupSchema], default: [] })
  configGroups!: ConfigGroup[]

  @Prop({ type: [RecipeItemSchema], default: [] })
  recipe!: RecipeItem[]

  createdAt!: Date
  updatedAt!: Date
}

export type ProductDocument = HydratedDocument<Product>

export const ProductSchema = SchemaFactory.createForClass(Product)

const subId = (value: { _id?: Types.ObjectId }): string => value._id?.toString() ?? ''

export interface PublicConfigOption {
  id: string
  name: string
  extraPrice: number
  available: boolean
}

export interface PublicConfigGroup {
  id: string
  name: string
  type: ConfigGroupType
  required: boolean
  min: number | null
  max: number | null
  options: PublicConfigOption[]
}

export interface PublicRecipeItem {
  id: string
  ingredientId: string
  quantity: number
  optionAdjustments: { optionId: string; quantity: number }[]
}

export interface PublicProduct {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string | null
  available: boolean
  configGroups: PublicConfigGroup[]
  recipe: PublicRecipeItem[]
}

export const serializeOption = (option: ConfigOption): PublicConfigOption => ({
  id: subId(option),
  name: option.name,
  extraPrice: option.extraPrice,
  available: option.available,
})

export const serializeGroup = (group: ConfigGroup): PublicConfigGroup => ({
  id: subId(group),
  name: group.name,
  type: group.type,
  required: group.required,
  min: group.min ?? null,
  max: group.max ?? null,
  options: group.options.map(serializeOption),
})

const serializeRecipeItem = (item: RecipeItem): PublicRecipeItem => ({
  id: subId(item),
  ingredientId: item.ingredientId,
  quantity: item.quantity,
  optionAdjustments: item.optionAdjustments.map((adjustment) => ({
    optionId: adjustment.optionId,
    quantity: adjustment.quantity,
  })),
})

export const serializeProduct = (doc: ProductDocument): PublicProduct => ({
  id: doc._id.toString(),
  categoryId: doc.categoryId,
  name: doc.name,
  description: doc.description,
  price: doc.price,
  image: doc.image ?? null,
  available: doc.available,
  configGroups: doc.configGroups.map(serializeGroup),
  recipe: doc.recipe.map(serializeRecipeItem),
})
