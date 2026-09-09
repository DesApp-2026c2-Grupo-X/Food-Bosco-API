import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({
  collection: 'branchProductAvailability',
  timestamps: { createdAt: true, updatedAt: true },
})
export class BranchProductAvailability {
  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true, index: true })
  productId!: string

  @Prop({ default: true })
  available!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type BranchProductAvailabilityDocument = HydratedDocument<BranchProductAvailability>

export const BranchProductAvailabilitySchema =
  SchemaFactory.createForClass(BranchProductAvailability)

BranchProductAvailabilitySchema.index({ branchId: 1, productId: 1 }, { unique: true })
