import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql'
import { PromotionScope } from '../common/promotion-scope.enum'
import { PromotionType } from '../common/promotion-type.enum'
import { OrderStatus } from '../common/order-status.enum'
import { Branch, Category, Product } from './commerce.types'

export enum RecommendationReason {
  REPEAT = 'REPEAT',
  FAVORITE_CATEGORY = 'FAVORITE_CATEGORY',
  DISCOVERY = 'DISCOVERY',
  POPULAR = 'POPULAR',
}

registerEnumType(RecommendationReason, { name: 'RecommendationReason' })

@ObjectType()
export class ProductRecommendation {
  @Field(() => Product)
  product!: Product

  @Field(() => RecommendationReason)
  reason!: RecommendationReason

  @Field(() => String, { nullable: true })
  hint!: string | null

  @Field(() => Float)
  score!: number
}

@ObjectType()
export class NearbyBranch {
  @Field(() => Branch)
  branch!: Branch

  @Field(() => Float)
  distanceMeters!: number
}

@ObjectType()
export class PromotionSummary {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => String, { nullable: true })
  description!: string | null

  @Field()
  startDate!: string

  @Field()
  endDate!: string

  @Field(() => PromotionType, { nullable: true })
  type!: PromotionType | null

  @Field(() => Float, { nullable: true })
  discountValue!: number | null

  @Field(() => Float, { nullable: true })
  maxDiscount!: number | null

  @Field(() => Int, { nullable: true })
  buyQuantity!: number | null

  @Field(() => Int, { nullable: true })
  payQuantity!: number | null

  @Field(() => PromotionScope, { nullable: true })
  scope!: PromotionScope | null

  @Field(() => [ID])
  categoryIds!: string[]

  @Field(() => [ID])
  productIds!: string[]

  @Field(() => [ID])
  branchIds!: string[]

  @Field(() => Float)
  minSubtotal!: number

  @Field(() => Int)
  minQuantity!: number

  @Field(() => [Int])
  daysOfWeek!: number[]

  @Field(() => String, { nullable: true })
  startTime!: string | null

  @Field(() => String, { nullable: true })
  endTime!: string | null
}

@ObjectType()
export class ReorderItem {
  @Field(() => ID)
  productId!: string

  @Field()
  name!: string

  @Field(() => Int)
  quantity!: number
}

@ObjectType()
export class ReorderCard {
  @Field(() => ID)
  id!: string

  @Field()
  number!: string

  @Field(() => OrderStatus)
  status!: OrderStatus

  @Field()
  createdAt!: string

  @Field(() => Float)
  total!: number

  @Field(() => ID)
  branchId!: string

  @Field(() => Branch, { nullable: true })
  branch!: Branch | null

  @Field(() => [ReorderItem])
  items!: ReorderItem[]
}

@ObjectType()
export class HomeFeed {
  @Field()
  generatedAt!: string

  @Field()
  hasHistory!: boolean

  @Field(() => Category, { nullable: true })
  topCategory!: Category | null

  @Field(() => Branch, { nullable: true })
  favoriteBranch!: Branch | null

  @Field(() => NearbyBranch, { nullable: true })
  nearestBranch!: NearbyBranch | null

  @Field(() => [Category])
  categories!: Category[]

  @Field(() => [ProductRecommendation])
  forYou!: ProductRecommendation[]

  @Field(() => [ProductRecommendation])
  discovery!: ProductRecommendation[]

  @Field(() => [ReorderCard])
  reorder!: ReorderCard[]

  @Field(() => [PromotionSummary])
  promotions!: PromotionSummary[]
}
