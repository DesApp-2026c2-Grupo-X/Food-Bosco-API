import { Field, InputType } from '@nestjs/graphql'

@InputType()
export class UpdateRiderProfileInput {
  @Field({ nullable: true })
  vehicle?: string

  @Field({ nullable: true })
  phone?: string
}
