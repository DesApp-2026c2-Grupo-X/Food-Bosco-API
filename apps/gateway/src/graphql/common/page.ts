import { Field, InputType, Int, ObjectType } from '@nestjs/graphql'

@InputType()
export class PageInput {
  @Field(() => Int, { nullable: true })
  limit?: number

  @Field(() => Int, { nullable: true })
  offset?: number
}

@ObjectType()
export class PageInfo {
  @Field(() => Int)
  total!: number

  @Field(() => Int)
  limit!: number

  @Field(() => Int)
  offset!: number
}
