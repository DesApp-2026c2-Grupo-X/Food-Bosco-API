import { Field, Float, InputType } from '@nestjs/graphql'

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

@InputType()
export class PublishDeliveryTariffInput {
  @Field(() => Float)
  baseFare!: number

  @Field(() => Float)
  perKm!: number

  @Field(() => Float)
  perOrder!: number

  @Field(() => String)
  currency!: string
}
