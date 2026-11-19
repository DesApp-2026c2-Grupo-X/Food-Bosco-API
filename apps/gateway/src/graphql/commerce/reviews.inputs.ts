import { Field, InputType, Int } from '@nestjs/graphql'

@InputType()
export class CreateOrderReviewInput {
  @Field(() => Int)
  branchRating!: number

  @Field(() => String, { nullable: true })
  branchComment?: string | null

  @Field(() => Int, { nullable: true })
  courierRating?: number | null

  @Field(() => String, { nullable: true })
  courierComment?: string | null
}

@InputType()
export class ReviewFilterInput {
  @Field(() => String, { nullable: true })
  from?: string

  @Field(() => String, { nullable: true })
  to?: string

  @Field(() => Int, { nullable: true })
  limit?: number
}
