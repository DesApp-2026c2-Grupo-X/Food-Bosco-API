import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { PROMOTION_REDEMPTION_STATUS_VALUES } from '../config/constants'
import type { PromotionRedemptionStatus } from '../config/constants'

@Schema({ collection: 'promotionRedemptions', timestamps: true })
export class PromotionRedemption {
  @Prop({ required: true, index: true })
  promotionId!: string

  @Prop({ required: true, index: true })
  orderId!: string

  @Prop({ required: true, index: true })
  clientId!: string

  @Prop({ default: null, type: String, uppercase: true })
  code!: string | null

  @Prop({ required: true })
  amount!: number

  @Prop({ required: true, enum: PROMOTION_REDEMPTION_STATUS_VALUES, type: String })
  status!: PromotionRedemptionStatus

  @Prop({ default: null, type: Date })
  releasedAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export type PromotionRedemptionDocument = HydratedDocument<PromotionRedemption>

export const PromotionRedemptionSchema = SchemaFactory.createForClass(PromotionRedemption)

PromotionRedemptionSchema.index({ promotionId: 1, orderId: 1 }, { unique: true })
PromotionRedemptionSchema.index({ promotionId: 1, status: 1 })
PromotionRedemptionSchema.index({ promotionId: 1, clientId: 1, status: 1 })
