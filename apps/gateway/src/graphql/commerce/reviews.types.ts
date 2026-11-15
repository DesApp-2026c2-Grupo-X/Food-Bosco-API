import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql'
import {
  asNumber,
  asRecordList,
  asString,
  idOf,
  nullableNumber,
  nullableString,
} from '../common/mappers'
import type { RawRecord } from '../common/mappers'
import { Branch } from './commerce.types'
import { Rider } from '../delivery/delivery.types'

@ObjectType()
export class RatingBreakdown {
  @Field(() => Int)
  rating!: number

  @Field(() => Int)
  count!: number
}

@ObjectType()
export class ReviewComment {
  @Field(() => Int)
  rating!: number

  @Field(() => String, { nullable: true })
  comment!: string | null

  @Field()
  createdAt!: string
}

@ObjectType()
export class OrderReview {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  orderId!: string

  @Field(() => ID)
  customerId!: string

  @Field(() => ID)
  branchId!: string

  @Field(() => Branch, { nullable: true })
  branch?: Branch | null

  @Field(() => Int)
  branchRating!: number

  @Field(() => String, { nullable: true })
  branchComment!: string | null

  @Field(() => ID, { nullable: true })
  courierId!: string | null

  @Field(() => Int, { nullable: true })
  courierRating!: number | null

  @Field(() => String, { nullable: true })
  courierComment!: string | null

  @Field()
  createdAt!: string

  @Field()
  updatedAt!: string
}

@ObjectType()
export class OrderReviewStatus {
  @Field()
  canReview!: boolean

  @Field(() => OrderReview, { nullable: true })
  review!: OrderReview | null
}

@ObjectType()
export class BranchReviewStats {
  @Field(() => ID)
  branchId!: string

  @Field(() => Float)
  averageRating!: number

  @Field(() => Int)
  totalReviews!: number

  @Field(() => [RatingBreakdown])
  distribution!: RatingBreakdown[]

  @Field(() => [ReviewComment])
  comments!: ReviewComment[]
}

@ObjectType()
export class CourierReviewStats {
  @Field(() => ID)
  courierId!: string

  @Field(() => Float)
  averageRating!: number

  @Field(() => Int)
  totalReviews!: number

  @Field(() => [RatingBreakdown])
  distribution!: RatingBreakdown[]

  @Field(() => [ReviewComment])
  comments!: ReviewComment[]
}

@ObjectType()
export class BranchRatingRow {
  @Field(() => ID)
  branchId!: string

  @Field(() => Branch, { nullable: true })
  branch?: Branch | null

  @Field(() => Float)
  averageRating!: number

  @Field(() => Int)
  totalReviews!: number
}

@ObjectType()
export class CourierRatingRow {
  @Field(() => ID)
  courierId!: string

  @Field(() => Rider, { nullable: true })
  rider?: Rider | null

  @Field(() => Float)
  averageRating!: number

  @Field(() => Int)
  totalReviews!: number
}

@ObjectType()
export class ReviewsSummary {
  @Field(() => Float)
  branchAverageRating!: number

  @Field(() => Int)
  branchReviews!: number

  @Field(() => Float)
  courierAverageRating!: number

  @Field(() => Int)
  courierReviews!: number
}

const mapBreakdown = (raw: RawRecord): RatingBreakdown => ({
  rating: asNumber(raw.rating),
  count: asNumber(raw.count),
})

const mapComment = (raw: RawRecord): ReviewComment => ({
  rating: asNumber(raw.rating),
  comment: nullableString(raw.comment),
  createdAt: asString(raw.createdAt),
})

export const mapOrderReview = (raw: RawRecord): OrderReview => ({
  id: idOf(raw),
  orderId: asString(raw.orderId),
  customerId: asString(raw.customerId),
  branchId: asString(raw.branchId),
  branchRating: asNumber(raw.branchRating),
  branchComment: nullableString(raw.branchComment),
  courierId: nullableString(raw.courierId),
  courierRating: nullableNumber(raw.courierRating),
  courierComment: nullableString(raw.courierComment),
  createdAt: asString(raw.createdAt),
  updatedAt: asString(raw.updatedAt),
})

export const mapOrderReviewStatus = (raw: RawRecord): OrderReviewStatus => ({
  canReview: Boolean(raw.canReview),
  review: raw.review ? mapOrderReview(raw.review as RawRecord) : null,
})

export const mapBranchReviewStats = (raw: RawRecord): BranchReviewStats => ({
  branchId: asString(raw.branchId),
  averageRating: asNumber(raw.averageRating),
  totalReviews: asNumber(raw.totalReviews),
  distribution: asRecordList(raw.distribution).map(mapBreakdown),
  comments: asRecordList(raw.comments).map(mapComment),
})

export const mapCourierReviewStats = (raw: RawRecord): CourierReviewStats => ({
  courierId: asString(raw.courierId),
  averageRating: asNumber(raw.averageRating),
  totalReviews: asNumber(raw.totalReviews),
  distribution: asRecordList(raw.distribution).map(mapBreakdown),
  comments: asRecordList(raw.comments).map(mapComment),
})

export const mapBranchRatingRow = (raw: RawRecord): BranchRatingRow => ({
  branchId: asString(raw.branchId),
  averageRating: asNumber(raw.averageRating),
  totalReviews: asNumber(raw.totalReviews),
})

export const mapCourierRatingRow = (raw: RawRecord): CourierRatingRow => ({
  courierId: asString(raw.courierId),
  averageRating: asNumber(raw.averageRating),
  totalReviews: asNumber(raw.totalReviews),
})

export const mapReviewsSummary = (raw: RawRecord): ReviewsSummary => ({
  branchAverageRating: asNumber(raw.branchAverageRating),
  branchReviews: asNumber(raw.branchReviews),
  courierAverageRating: asNumber(raw.courierAverageRating),
  courierReviews: asNumber(raw.courierReviews),
})
