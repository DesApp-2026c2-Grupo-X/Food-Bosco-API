import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'branchStock', timestamps: { createdAt: true, updatedAt: true } })
export class BranchStock {
  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true, index: true })
  ingredientId!: string

  @Prop({ required: true, default: 0 })
  quantity!: number

  createdAt!: Date
  updatedAt!: Date
}

export type BranchStockDocument = HydratedDocument<BranchStock>

export const BranchStockSchema = SchemaFactory.createForClass(BranchStock)

BranchStockSchema.index({ branchId: 1, ingredientId: 1 }, { unique: true })

export interface PublicBranchStock {
  ingredientId: string
  branchId: string
  quantity: number
}

export const serializeBranchStock = (doc: BranchStockDocument): PublicBranchStock => ({
  ingredientId: doc.ingredientId,
  branchId: doc.branchId,
  quantity: doc.quantity,
})
