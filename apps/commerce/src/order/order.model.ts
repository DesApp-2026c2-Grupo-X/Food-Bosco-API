import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { ORDER_STATUS, ORDER_STATUS_VALUES, ORDER_TRANSITIONS } from '../config/constants'
import type { OrderStatus } from '../config/constants'

@Schema({ _id: false })
export class OrderItemOption {
  @Prop({ required: true })
  optionId!: string

  @Prop({ required: true })
  name!: string

  @Prop({ required: true })
  extraPrice!: number
}

export const OrderItemOptionSchema = SchemaFactory.createForClass(OrderItemOption)

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  productId!: string

  @Prop({ required: true })
  name!: string

  @Prop({ required: true })
  unitPrice!: number

  @Prop({ required: true })
  quantity!: number

  @Prop({ default: null, type: String })
  observations!: string | null

  @Prop({ required: true })
  subtotal!: number

  @Prop({ type: [OrderItemOptionSchema], default: [] })
  options!: OrderItemOption[]
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem)

@Schema({ _id: false })
export class OrderStatusHistory {
  @Prop({ required: true, type: String })
  previousStatus!: OrderStatus

  @Prop({ required: true, type: String })
  newStatus!: OrderStatus

  @Prop({ required: true, type: Date })
  changedAt!: Date
}

export const OrderStatusHistorySchema = SchemaFactory.createForClass(OrderStatusHistory)

@Schema({ _id: false })
export class DeliveryAddressSnapshot {
  @Prop({ required: true })
  text!: string

  @Prop({ required: true })
  latitude!: number

  @Prop({ required: true })
  longitude!: number
}

export const DeliveryAddressSnapshotSchema = SchemaFactory.createForClass(DeliveryAddressSnapshot)

@Schema({ collection: 'orders', timestamps: { createdAt: true, updatedAt: true } })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  number!: string

  @Prop({ required: true, index: true })
  clientId!: string

  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true })
  addressId!: string

  @Prop({ required: true, type: DeliveryAddressSnapshotSchema, _id: false })
  deliveryAddress!: DeliveryAddressSnapshot

  @Prop({ required: true, enum: ORDER_STATUS_VALUES, type: String, default: ORDER_STATUS.pending })
  status!: OrderStatus

  @Prop({ required: true })
  total!: number

  @Prop({ default: null, type: Date })
  estimatedDeliveryAt!: Date | null

  @Prop({ default: null, type: String })
  riderId!: string | null

  @Prop({ default: null, type: String })
  tripId!: string | null

  @Prop({ type: [OrderItemSchema], default: [] })
  items!: OrderItem[]

  @Prop({ type: [OrderStatusHistorySchema], default: [] })
  statusHistory!: OrderStatusHistory[]

  createdAt!: Date
  updatedAt!: Date
}

export type OrderDocument = HydratedDocument<Order>

export const OrderSchema = SchemaFactory.createForClass(Order)

export interface PublicOrderItemOption {
  optionId: string
  name: string
  extraPrice: number
}

export interface PublicOrderItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  observations: string | null
  subtotal: number
  options: PublicOrderItemOption[]
}

export interface PublicOrderStatusHistory {
  previousStatus: OrderStatus
  newStatus: OrderStatus
  changedAt: string
}

export interface PublicOrder {
  id: string
  number: string
  clientId: string
  branchId: string
  addressId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: OrderStatus
  total: number
  estimatedDeliveryAt: string | null
  riderId: string | null
  tripId: string | null
  createdAt: string
  items: PublicOrderItem[]
  statusHistory: PublicOrderStatusHistory[]
  availableTransitions: OrderStatus[]
}

const serializeOption = (option: OrderItemOption): PublicOrderItemOption => ({
  optionId: option.optionId,
  name: option.name,
  extraPrice: option.extraPrice,
})

const serializeItem = (item: OrderItem): PublicOrderItem => ({
  productId: item.productId,
  name: item.name,
  unitPrice: item.unitPrice,
  quantity: item.quantity,
  observations: item.observations ?? null,
  subtotal: item.subtotal,
  options: item.options.map(serializeOption),
})

const serializeHistory = (entry: OrderStatusHistory): PublicOrderStatusHistory => ({
  previousStatus: entry.previousStatus,
  newStatus: entry.newStatus,
  changedAt: entry.changedAt.toISOString(),
})

export const serializeOrder = (doc: OrderDocument): PublicOrder => ({
  id: doc._id.toString(),
  number: doc.number,
  clientId: doc.clientId,
  branchId: doc.branchId,
  addressId: doc.addressId,
  deliveryAddress: {
    text: doc.deliveryAddress.text,
    latitude: doc.deliveryAddress.latitude,
    longitude: doc.deliveryAddress.longitude,
  },
  status: doc.status,
  total: doc.total,
  estimatedDeliveryAt: doc.estimatedDeliveryAt?.toISOString() ?? null,
  riderId: doc.riderId ?? null,
  tripId: doc.tripId ?? null,
  createdAt: doc.createdAt.toISOString(),
  items: doc.items.map(serializeItem),
  statusHistory: doc.statusHistory.map(serializeHistory),
  availableTransitions: ORDER_TRANSITIONS[doc.status],
})
