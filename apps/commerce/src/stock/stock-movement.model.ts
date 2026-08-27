import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { STOCK_MOVEMENT_REASON } from '../config/constants'
import type { StockMovementReason } from '../config/constants'

@Schema({ collection: 'stockMovements', timestamps: { createdAt: true, updatedAt: false } })
export class StockMovement {
  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true, index: true })
  ingredientId!: string

  @Prop({ required: true })
  delta!: number

  @Prop({ required: true, enum: [STOCK_MOVEMENT_REASON.adjust, STOCK_MOVEMENT_REASON.preparing], type: String })
  reason!: StockMovementReason

  @Prop({ default: null, type: String })
  orderId!: string | null

  createdAt!: Date
}

export type StockMovementDocument = HydratedDocument<StockMovement>

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement)

export interface PublicStockMovement {
  id: string
  branchId: string
  ingredientId: string
  delta: number
  reason: StockMovementReason
  orderId: string | null
  createdAt: string
}

export const serializeStockMovement = (doc: StockMovementDocument): PublicStockMovement => ({
  id: doc._id.toString(),
  branchId: doc.branchId,
  ingredientId: doc.ingredientId,
  delta: doc.delta,
  reason: doc.reason,
  orderId: doc.orderId ?? null,
  createdAt: doc.createdAt.toISOString(),
})
