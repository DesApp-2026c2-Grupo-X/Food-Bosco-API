import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'orderStates', timestamps: { createdAt: true, updatedAt: true } })
export class OrderState {
  @Prop({ required: true, unique: true, index: true, trim: true })
  code!: string

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true })
  order!: number

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type OrderStateDocument = HydratedDocument<OrderState>

export const OrderStateSchema = SchemaFactory.createForClass(OrderState)

export interface PublicOrderState {
  code: string
  name: string
  order: number
  active: boolean
}

export const serializeOrderState = (doc: OrderStateDocument): PublicOrderState => ({
  code: doc.code,
  name: doc.name,
  order: doc.order,
  active: doc.active,
})
