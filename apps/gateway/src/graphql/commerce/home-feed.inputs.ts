import { Field, InputType, ID, Float, Int } from '@nestjs/graphql'

@InputType()
export class HomeFeedInput {
  @Field(() => ID, { nullable: true })
  addressId?: string

  @Field(() => Float, { nullable: true })
  lat?: number

  @Field(() => Float, { nullable: true })
  lng?: number

  @Field(() => Int, { nullable: true })
  forYouLimit?: number

  @Field(() => Int, { nullable: true })
  discoveryLimit?: number

  @Field(() => Int, { nullable: true })
  reorderLimit?: number
}
