import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export const REVIEW_COMMENT_MAX_LENGTH = 500
export const REVIEW_MIN_RATING = 1
export const REVIEW_MAX_RATING = 5

@Schema({ collection: 'orderReviews', timestamps: { createdAt: true, updatedAt: true } })
export class OrderReview {
  @Prop({ required: true, unique: true, index: true })
  orderId!: string

  @Prop({ required: true, index: true })
  customerId!: string

  @Prop({ required: true, index: true })
  branchId!: string

  @Prop({ required: true, min: REVIEW_MIN_RATING, max: REVIEW_MAX_RATING })
  branchRating!: number

  @Prop({ default: null, type: String, trim: true, maxlength: REVIEW_COMMENT_MAX_LENGTH })
  branchComment!: string | null

  @Prop({ default: null, type: String, index: true })
  courierId!: string | null

  @Prop({ default: null, type: Number, min: REVIEW_MIN_RATING, max: REVIEW_MAX_RATING })
  courierRating!: number | null

  @Prop({ default: null, type: String, trim: true, maxlength: REVIEW_COMMENT_MAX_LENGTH })
  courierComment!: string | null

  createdAt!: Date
  updatedAt!: Date
}

export type OrderReviewDocument = HydratedDocument<OrderReview>

export const OrderReviewSchema = SchemaFactory.createForClass(OrderReview)

OrderReviewSchema.index({ branchId: 1, createdAt: -1 })
OrderReviewSchema.index({ courierId: 1, createdAt: -1 })

export interface PublicOrderReview {
  id: string
  orderId: string
  customerId: string
  branchId: string
  branchRating: number
  branchComment: string | null
  courierId: string | null
  courierRating: number | null
  courierComment: string | null
  createdAt: string
  updatedAt: string
}

export interface RatingBreakdownEntry {
  rating: number
  count: number
}

export interface ReviewCommentEntry {
  rating: number
  comment: string | null
  createdAt: string
}

export interface BranchReviewStats {
  branchId: string
  averageRating: number
  totalReviews: number
  distribution: RatingBreakdownEntry[]
  comments: ReviewCommentEntry[]
}

export interface CourierReviewStats {
  courierId: string
  averageRating: number
  totalReviews: number
  distribution: RatingBreakdownEntry[]
  comments: ReviewCommentEntry[]
}

export interface BranchRatingRow {
  branchId: string
  averageRating: number
  totalReviews: number
}

export interface CourierRatingRow {
  courierId: string
  averageRating: number
  totalReviews: number
}

export interface ReviewsSummary {
  branchAverageRating: number
  branchReviews: number
  courierAverageRating: number
  courierReviews: number
}

export const serializeOrderReview = (doc: OrderReviewDocument): PublicOrderReview => ({
  id: doc._id.toString(),
  orderId: doc.orderId,
  customerId: doc.customerId,
  branchId: doc.branchId,
  branchRating: doc.branchRating,
  branchComment: doc.branchComment ?? null,
  courierId: doc.courierId ?? null,
  courierRating: doc.courierRating ?? null,
  courierComment: doc.courierComment ?? null,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
})

export const emptyDistribution = (): RatingBreakdownEntry[] =>
  Array.from({ length: REVIEW_MAX_RATING }, (_, index) => ({
    rating: index + 1,
    count: 0,
  }))
