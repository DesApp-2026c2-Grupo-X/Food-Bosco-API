import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'deliveryTariffs', timestamps: { createdAt: true, updatedAt: true } })
export class DeliveryTariff {
  @Prop({ required: true, min: 0 })
  baseFare!: number

  @Prop({ required: true, min: 0 })
  perKm!: number

  @Prop({ required: true, min: 0 })
  perOrder!: number

  @Prop({ required: true, default: 'ARS', trim: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency!: string

  @Prop({ required: true, default: () => new Date() })
  effectiveFrom!: Date

  @Prop({ required: true, default: false })
  active!: boolean

  @Prop({ required: true, trim: true })
  createdBy!: string

  createdAt!: Date
  updatedAt!: Date
}

export type DeliveryTariffDocument = HydratedDocument<DeliveryTariff>

export const DeliveryTariffSchema = SchemaFactory.createForClass(DeliveryTariff)

DeliveryTariffSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
)
DeliveryTariffSchema.index({ effectiveFrom: -1 })

export interface PublicDeliveryTariff {
  id: string
  baseFare: number
  perKm: number
  perOrder: number
  currency: string
  effectiveFrom: string
  active: boolean
  createdBy: string
  createdAt: string
}

export const serializeDeliveryTariff = (
  doc: DeliveryTariffDocument,
): PublicDeliveryTariff => ({
  id: doc._id.toString(),
  baseFare: doc.baseFare,
  perKm: doc.perKm,
  perOrder: doc.perOrder,
  currency: doc.currency,
  effectiveFrom: doc.effectiveFrom.toISOString(),
  active: doc.active,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt.toISOString(),
})
