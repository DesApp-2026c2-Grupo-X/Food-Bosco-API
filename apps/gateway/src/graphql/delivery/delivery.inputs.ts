import { Field, InputType } from '@nestjs/graphql'

@InputType()
export class UpdateRiderProfileInput {
  @Field({ nullable: true })
  phone?: string
}

@InputType()
export class UpdateVehicleInput {
  @Field()
  type!: string

  @Field({ nullable: true })
  brand?: string

  @Field({ nullable: true })
  model?: string

  @Field({ nullable: true })
  plate?: string
}
