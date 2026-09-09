import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'promotions', timestamps: { createdAt: true, updatedAt: true } })
export class Promotion {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ default: null, type: String, trim: true })
  description!: string | null

  @Prop({ required: true, type: Date })
  startDate!: Date

  @Prop({ required: true, type: Date })
  endDate!: Date

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type PromotionDocument = HydratedDocument<Promotion>

export const PromotionSchema = SchemaFactory.createForClass(Promotion)

export interface PublicPromotion {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  active: boolean
}

export const serializePromotion = (doc: PromotionDocument): PublicPromotion => ({
  id: doc._id.toString(),
  name: doc.name,
  description: doc.description ?? null,
  startDate: doc.startDate.toISOString(),
  endDate: doc.endDate.toISOString(),
  active: doc.active,
})
