import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { CART_STATUS, CART_STATUS_VALUES } from '../config/constants'
import type { CartStatus } from '../config/constants'

@Schema()
export class CartItem {
  readonly _id?: Types.ObjectId

  @Prop({ required: true })
  productId!: string

  @Prop({ required: true, min: 1 })
  quantity!: number

  @Prop({ default: null, type: String, trim: true })
  observations!: string | null

  @Prop({ type: [String], default: [] })
  optionIds!: string[]
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem)

@Schema({ collection: 'carts', timestamps: { createdAt: true, updatedAt: true } })
export class Cart {
  @Prop({ required: true, index: true })
  clientId!: string

  @Prop({ required: true, enum: CART_STATUS_VALUES, type: String, default: CART_STATUS.active })
  status!: CartStatus

  @Prop({ type: [CartItemSchema], default: [] })
  items!: CartItem[]

  @Prop({ required: true, default: 0 })
  total!: number

  createdAt!: Date
  updatedAt!: Date
}

export type CartDocument = HydratedDocument<Cart>

export const CartSchema = SchemaFactory.createForClass(Cart)

const subId = (value: { _id?: Types.ObjectId }): string => value._id?.toString() ?? ''

export interface PublicCartItem {
  id: string
  productId: string
  quantity: number
  observations: string | null
  optionIds: string[]
}

export interface PublicCart {
  id: string
  clientId: string
  status: CartStatus
  items: PublicCartItem[]
  total: number
}

const serializeItem = (item: CartItem): PublicCartItem => ({
  id: subId(item),
  productId: item.productId,
  quantity: item.quantity,
  observations: item.observations ?? null,
  optionIds: item.optionIds,
})

export const serializeCart = (doc: CartDocument): PublicCart => ({
  id: doc._id.toString(),
  clientId: doc.clientId,
  status: doc.status,
  items: doc.items.map(serializeItem),
  total: doc.total,
})
