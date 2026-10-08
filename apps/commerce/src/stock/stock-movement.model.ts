import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'stockMovements', timestamps: { createdAt: true, updatedAt: false } })
export class StockMovement {
  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true, index: true })
  ingredientId!: string

  @Prop({ required: true })
  delta!: number

  @Prop({ required: true, default: 'adjust', type: String })
  reason!: string

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
  reason: string
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
