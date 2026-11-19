import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { PROMOTION_SCOPE_VALUES, PROMOTION_TYPE_VALUES } from '../config/constants'
import type { PromotionScope, PromotionType } from '../config/constants'

export const PROMOTION_ALREADY_EXISTS = 'PROMOTION_ALREADY_EXISTS'

@Schema({ collection: 'promotions', timestamps: { createdAt: true, updatedAt: true } })
export class Promotion {
  @Prop({ required: true, unique: true, index: true, trim: true })
  name!: string

  @Prop({ default: null, type: String, trim: true })
  description!: string | null

  @Prop({ required: true, type: Date })
  startDate!: Date

  @Prop({ required: true, type: Date })
  endDate!: Date

  @Prop({ default: true })
  active!: boolean

  // --- Motor de promociones ---
  @Prop({ default: null, enum: PROMOTION_TYPE_VALUES, type: String })
  type!: PromotionType | null // null = promoción informativa legacy

  @Prop({ default: null, type: Number })
  discountValue!: number | null // % (0, 100] o monto > 0

  @Prop({ default: null, type: Number })
  maxDiscount!: number | null // tope para PERCENTAGE

  @Prop({ default: null, type: Number })
  buyQuantity!: number | null // NxM

  @Prop({ default: null, type: Number })
  payQuantity!: number | null // NxM

  @Prop({ default: null, enum: PROMOTION_SCOPE_VALUES, type: String })
  scope!: PromotionScope | null

  @Prop({ type: [String], default: [] })
  categoryIds!: string[]

  @Prop({ type: [String], default: [] })
  productIds!: string[]

  @Prop({ type: [String], default: [] })
  branchIds!: string[] // vacío = todas

  @Prop({ default: 0, min: 0 })
  minSubtotal!: number

  @Prop({ default: 0, min: 0 })
  minQuantity!: number

  @Prop({ type: [Number], default: [] })
  daysOfWeek!: number[] // 0-6; vacío = todos

  @Prop({ default: null, type: String })
  startTime!: string | null // 'HH:mm'

  @Prop({ default: null, type: String })
  endTime!: string | null // 'HH:mm'; si end < start, cruza medianoche

  @Prop({ default: null, type: String, uppercase: true, trim: true })
  code!: string | null // cupón; único sparse

  @Prop({ default: false })
  stackable!: boolean

  @Prop({ default: 0, type: Number })
  priority!: number

  @Prop({ default: null, type: Number })
  maxUsesTotal!: number | null

  @Prop({ default: null, type: Number })
  maxUsesPerCustomer!: number | null

  @Prop({ default: 0, type: Number })
  usedCount!: number // denormalizado; el ledger es la fuente de verdad

  createdAt!: Date
  updatedAt!: Date
}

export type PromotionDocument = HydratedDocument<Promotion>

export const PromotionSchema = SchemaFactory.createForClass(Promotion)

PromotionSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: 'string' } },
  },
)
PromotionSchema.index({ active: 1, startDate: 1, endDate: 1 })
PromotionSchema.index({ branchIds: 1 })

export interface PublicPromotion {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  active: boolean
  type: PromotionType | null
  discountValue: number | null
  maxDiscount: number | null
  buyQuantity: number | null
  payQuantity: number | null
  scope: PromotionScope | null
  categoryIds: string[]
  productIds: string[]
  branchIds: string[]
  minSubtotal: number
  minQuantity: number
  daysOfWeek: number[]
  startTime: string | null
  endTime: string | null
  code: string | null
  stackable: boolean
  priority: number
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
}

export const serializePromotion = (doc: PromotionDocument): PublicPromotion => ({
  id: doc._id.toString(),
  name: doc.name,
  description: doc.description ?? null,
  startDate: doc.startDate.toISOString(),
  endDate: doc.endDate.toISOString(),
  active: doc.active,
  type: doc.type ?? null,
  discountValue: doc.discountValue ?? null,
  maxDiscount: doc.maxDiscount ?? null,
  buyQuantity: doc.buyQuantity ?? null,
  payQuantity: doc.payQuantity ?? null,
  scope: doc.scope ?? null,
  categoryIds: doc.categoryIds ?? [],
  productIds: doc.productIds ?? [],
  branchIds: doc.branchIds ?? [],
  minSubtotal: doc.minSubtotal ?? 0,
  minQuantity: doc.minQuantity ?? 0,
  daysOfWeek: doc.daysOfWeek ?? [],
  startTime: doc.startTime ?? null,
  endTime: doc.endTime ?? null,
  code: doc.code ?? null,
  stackable: Boolean(doc.stackable),
  priority: doc.priority ?? 0,
  maxUsesTotal: doc.maxUsesTotal ?? null,
  maxUsesPerCustomer: doc.maxUsesPerCustomer ?? null,
  usedCount: doc.usedCount ?? 0,
})

export interface PublicBannerPromotion {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  type: PromotionType | null
  discountValue: number | null
  maxDiscount: number | null
  buyQuantity: number | null
  payQuantity: number | null
  scope: PromotionScope | null
  categoryIds: string[]
  productIds: string[]
  branchIds: string[]
}

export const serializeBannerPromotion = (doc: PromotionDocument): PublicBannerPromotion => ({
  id: doc._id.toString(),
  name: doc.name,
  description: doc.description ?? null,
  startDate: doc.startDate.toISOString(),
  endDate: doc.endDate.toISOString(),
  type: doc.type ?? null,
  discountValue: doc.discountValue ?? null,
  maxDiscount: doc.maxDiscount ?? null,
  buyQuantity: doc.buyQuantity ?? null,
  payQuantity: doc.payQuantity ?? null,
  scope: doc.scope ?? null,
  categoryIds: doc.categoryIds ?? [],
  productIds: doc.productIds ?? [],
  branchIds: doc.branchIds ?? [],
})
