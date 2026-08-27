import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql'
import { User } from '../auth/auth.types'
import { ConfigGroupType, configGroupTypeFromRest } from '../common/config-group-type.enum'
import {
  asBoolean,
  asNumber,
  asRecordList,
  asString,
  asStringList,
  idOf,
  nullableString,
} from '../common/mappers'
import type { RawRecord } from '../common/mappers'
import { OrderStatus, orderStatusFromRest } from '../common/order-status.enum'

@ObjectType()
export class Category {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class ConfigOption {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => Float)
  extraPrice!: number

  @Field()
  available!: boolean
}

@ObjectType()
export class ConfigGroup {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => ConfigGroupType)
  type!: ConfigGroupType

  @Field()
  required!: boolean

  @Field(() => Int, { nullable: true })
  min!: number | null

  @Field(() => Int, { nullable: true })
  max!: number | null

  @Field(() => [ConfigOption])
  options!: ConfigOption[]
}

@ObjectType()
export class RecipeItem {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  ingredientId!: string

  @Field(() => Ingredient, { nullable: true })
  ingredient?: Ingredient | null

  @Field(() => Float)
  quantity!: number
}

@ObjectType()
export class Ingredient {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  unit!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  categoryId!: string

  @Field(() => Category, { nullable: true })
  category?: Category | null

  @Field()
  name!: string

  @Field()
  description!: string

  @Field(() => Float)
  price!: number

  @Field(() => String, { nullable: true })
  image!: string | null

  @Field()
  available!: boolean

  @Field(() => [ConfigGroup])
  configGroups!: ConfigGroup[]

  @Field(() => [RecipeItem])
  recipe!: RecipeItem[]
}

@ObjectType()
export class Promotion {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => String, { nullable: true })
  description!: string | null

  @Field()
  startDate!: string

  @Field()
  endDate!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class BranchHours {
  @Field(() => Int)
  dayOfWeek!: number

  @Field(() => String, { nullable: true })
  opening!: string | null

  @Field(() => String, { nullable: true })
  closing!: string | null

  @Field()
  closed!: boolean
}

@ObjectType()
export class Branch {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  addressText!: string

  @Field(() => Float)
  latitude!: number

  @Field(() => Float)
  longitude!: number

  @Field(() => String, { nullable: true })
  phone!: string | null

  @Field()
  active!: boolean

  @Field(() => [BranchHours])
  hours!: BranchHours[]
}

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  productId!: string

  @Field(() => Product, { nullable: true })
  product?: Product | null

  @Field(() => Int)
  quantity!: number

  @Field(() => String, { nullable: true })
  observations!: string | null

  @Field(() => [ID])
  optionIds!: string[]

  @Field(() => [ConfigOption])
  options!: ConfigOption[]
}

@ObjectType()
export class Cart {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  clientId!: string

  @Field()
  status!: string

  @Field(() => [CartItem])
  items!: CartItem[]

  @Field(() => Float)
  total!: number
}

@ObjectType()
export class OrderItemOption {
  @Field(() => ID)
  optionId!: string

  @Field()
  name!: string

  @Field(() => Float)
  extraPrice!: number
}

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  productId!: string

  @Field()
  name!: string

  @Field(() => Float)
  unitPrice!: number

  @Field(() => Int)
  quantity!: number

  @Field(() => String, { nullable: true })
  observations!: string | null

  @Field(() => Float)
  subtotal!: number

  @Field(() => [OrderItemOption])
  options!: OrderItemOption[]
}

@ObjectType()
export class OrderStatusHistory {
  @Field(() => OrderStatus)
  previousStatus!: OrderStatus

  @Field(() => OrderStatus)
  newStatus!: OrderStatus

  @Field()
  changedAt!: string
}

@ObjectType()
export class OrderAddress {
  @Field()
  text!: string

  @Field(() => Float)
  latitude!: number

  @Field(() => Float)
  longitude!: number
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string

  @Field()
  number!: string

  @Field(() => ID)
  clientId!: string

  @Field(() => User, { nullable: true })
  client?: User | null

  @Field(() => ID)
  branchId!: string

  @Field(() => Branch, { nullable: true })
  branch?: Branch | null

  @Field(() => OrderAddress)
  deliveryAddress!: OrderAddress

  @Field(() => OrderStatus)
  status!: OrderStatus

  @Field(() => Float)
  total!: number

  @Field(() => String, { nullable: true })
  estimatedDeliveryAt!: string | null

  @Field()
  createdAt!: string

  @Field(() => [OrderItem])
  items!: OrderItem[]

  @Field(() => [OrderStatusHistory])
  statusHistory!: OrderStatusHistory[]

  @Field(() => [OrderStatus])
  availableTransitions!: OrderStatus[]
}

@ObjectType()
export class RepeatOrderResult {
  @Field(() => Cart)
  cart!: Cart

  @Field(() => [Product])
  skippedProducts!: Product[]
}

@ObjectType()
export class BranchStock {
  @Field(() => ID)
  ingredientId!: string

  @Field(() => Ingredient, { nullable: true })
  ingredient?: Ingredient | null

  @Field(() => ID)
  branchId!: string

  @Field(() => Float)
  quantity!: number
}

@ObjectType()
export class StockMovement {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  branchId!: string

  @Field(() => ID)
  ingredientId!: string

  @Field(() => Float)
  delta!: number

  @Field()
  reason!: string

  @Field(() => ID, { nullable: true })
  orderId!: string | null

  @Field()
  createdAt!: string
}

@ObjectType()
export class Parameter {
  @Field()
  key!: string

  @Field(() => Float)
  value!: number

  @Field()
  unit!: string
}

@ObjectType()
export class OrderState {
  @Field()
  code!: string

  @Field()
  name!: string

  @Field(() => Int)
  order!: number

  @Field()
  active!: boolean
}

@ObjectType()
export class ProductReportRow {
  @Field(() => Int)
  position!: number

  @Field(() => Product)
  product!: Product

  @Field(() => Category, { nullable: true })
  category!: Category | null

  @Field(() => Int, { nullable: true })
  quantity!: number | null

  @Field(() => Float, { nullable: true })
  revenue!: number | null
}

@ObjectType()
export class OutOfStockRow {
  @Field(() => Product)
  product!: Product

  @Field(() => Category, { nullable: true })
  category!: Category | null

  @Field(() => Float)
  quantity!: number
}

const asStatusList = (value: unknown): OrderStatus[] =>
  Array.isArray(value)
    ? value.map((entry) => orderStatusFromRest(asString(entry)))
    : []

export const mapCategory = (raw: RawRecord): Category => ({
  id: idOf(raw),
  name: asString(raw.name),
  active: asBoolean(raw.active),
})

export const mapConfigOption = (raw: RawRecord): ConfigOption => ({
  id: idOf(raw),
  name: asString(raw.name),
  extraPrice: asNumber(raw.extraPrice),
  available: asBoolean(raw.available),
})

export const mapConfigGroup = (raw: RawRecord): ConfigGroup => ({
  id: idOf(raw),
  name: asString(raw.name),
  type: configGroupTypeFromRest(asString(raw.type)),
  required: asBoolean(raw.required),
  min: raw.min == null ? null : asNumber(raw.min),
  max: raw.max == null ? null : asNumber(raw.max),
  options: asRecordList(raw.options).map(mapConfigOption),
})

export const mapRecipeItem = (raw: RawRecord): RecipeItem => ({
  id: idOf(raw),
  ingredientId: asString(raw.ingredientId),
  quantity: asNumber(raw.quantity),
})

export const mapIngredient = (raw: RawRecord): Ingredient => ({
  id: idOf(raw),
  name: asString(raw.name),
  unit: asString(raw.unit),
  active: asBoolean(raw.active),
})

export const mapProduct = (raw: RawRecord): Product => ({
  id: idOf(raw),
  categoryId: asString(raw.categoryId),
  name: asString(raw.name),
  description: asString(raw.description),
  price: asNumber(raw.price),
  image: nullableString(raw.image),
  available: asBoolean(raw.available),
  configGroups: asRecordList(raw.configGroups).map(mapConfigGroup),
  recipe: asRecordList(raw.recipe).map(mapRecipeItem),
})

export const mapPromotion = (raw: RawRecord): Promotion => ({
  id: idOf(raw),
  name: asString(raw.name),
  description: nullableString(raw.description),
  startDate: asString(raw.startDate),
  endDate: asString(raw.endDate),
  active: asBoolean(raw.active),
})

export const mapBranchHour = (raw: RawRecord): BranchHours => ({
  dayOfWeek: asNumber(raw.dayOfWeek),
  opening: nullableString(raw.opening),
  closing: nullableString(raw.closing),
  closed: asBoolean(raw.closed),
})

export const mapBranch = (raw: RawRecord): Branch => ({
  id: idOf(raw),
  name: asString(raw.name),
  addressText: asString(raw.addressText),
  latitude: asNumber(raw.latitude),
  longitude: asNumber(raw.longitude),
  phone: nullableString(raw.phone),
  active: asBoolean(raw.active),
  hours: asRecordList(raw.hours).map(mapBranchHour),
})

export const mapCartItem = (raw: RawRecord): CartItem => ({
  id: idOf(raw),
  productId: asString(raw.productId),
  quantity: asNumber(raw.quantity),
  observations: nullableString(raw.observations),
  optionIds: asStringList(raw.optionIds),
  options: [],
})

export const mapCart = (raw: RawRecord): Cart => ({
  id: idOf(raw),
  clientId: asString(raw.clientId),
  status: asString(raw.status),
  items: asRecordList(raw.items).map(mapCartItem),
  total: asNumber(raw.total),
})

export const mapOrderItemOption = (raw: RawRecord): OrderItemOption => ({
  optionId: asString(raw.optionId),
  name: asString(raw.name),
  extraPrice: asNumber(raw.extraPrice),
})

export const mapOrderItem = (raw: RawRecord): OrderItem => ({
  productId: asString(raw.productId),
  name: asString(raw.name),
  unitPrice: asNumber(raw.unitPrice),
  quantity: asNumber(raw.quantity),
  observations: nullableString(raw.observations),
  subtotal: asNumber(raw.subtotal),
  options: asRecordList(raw.options).map(mapOrderItemOption),
})

export const mapOrderStatusHistory = (raw: RawRecord): OrderStatusHistory => ({
  previousStatus: orderStatusFromRest(asString(raw.previousStatus)),
  newStatus: orderStatusFromRest(asString(raw.newStatus)),
  changedAt: asString(raw.changedAt),
})

export const mapOrder = (raw: RawRecord): Order => ({
  id: idOf(raw),
  number: asString(raw.number),
  clientId: asString(raw.clientId),
  branchId: asString(raw.branchId),
  deliveryAddress: {
    text: asString((raw.deliveryAddress as RawRecord | undefined)?.text),
    latitude: asNumber((raw.deliveryAddress as RawRecord | undefined)?.latitude),
    longitude: asNumber((raw.deliveryAddress as RawRecord | undefined)?.longitude),
  },
  status: orderStatusFromRest(asString(raw.status)),
  total: asNumber(raw.total),
  estimatedDeliveryAt: nullableString(raw.estimatedDeliveryAt),
  createdAt: asString(raw.createdAt),
  items: asRecordList(raw.items).map(mapOrderItem),
  statusHistory: asRecordList(raw.statusHistory).map(mapOrderStatusHistory),
  availableTransitions: asStatusList(raw.availableTransitions),
})

export const mapBranchStock = (raw: RawRecord): BranchStock => ({
  ingredientId: asString(raw.ingredientId),
  branchId: asString(raw.branchId),
  quantity: asNumber(raw.quantity),
})

export const mapStockMovement = (raw: RawRecord): StockMovement => ({
  id: idOf(raw),
  branchId: asString(raw.branchId),
  ingredientId: asString(raw.ingredientId),
  delta: asNumber(raw.delta),
  reason: asString(raw.reason),
  orderId: nullableString(raw.orderId),
  createdAt: asString(raw.createdAt),
})

export const mapParameter = (raw: RawRecord): Parameter => ({
  key: asString(raw.key),
  value: asNumber(raw.value),
  unit: asString(raw.unit),
})

export const mapOrderState = (raw: RawRecord): OrderState => ({
  code: asString(raw.code),
  name: asString(raw.name),
  order: asNumber(raw.order),
  active: asBoolean(raw.active),
})

export const mapProductReportRow = (raw: RawRecord): ProductReportRow => ({
  position: asNumber(raw.position),
  product: mapProduct(raw.product as RawRecord),
  category: raw.category ? mapCategory(raw.category as RawRecord) : null,
  quantity: raw.quantity == null ? null : asNumber(raw.quantity),
  revenue: raw.revenue == null ? null : asNumber(raw.revenue),
})

export const mapOutOfStockRow = (raw: RawRecord): OutOfStockRow => ({
  product: mapProduct(raw.product as RawRecord),
  category: raw.category ? mapCategory(raw.category as RawRecord) : null,
  quantity: asNumber(raw.quantity),
})
