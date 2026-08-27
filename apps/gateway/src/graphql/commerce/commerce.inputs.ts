import { Field, Float, ID, InputType, Int } from '@nestjs/graphql'
import { ConfigGroupType } from '../common/config-group-type.enum'
import { OrderStatus } from '../common/order-status.enum'

@InputType()
export class CategoryInput {
  @Field()
  name!: string

  @Field({ nullable: true })
  active?: boolean
}

@InputType()
export class ConfigGroupInput {
  @Field()
  name!: string

  @Field(() => ConfigGroupType)
  type!: ConfigGroupType

  @Field()
  required!: boolean

  @Field(() => Int, { nullable: true })
  min?: number

  @Field(() => Int, { nullable: true })
  max?: number
}

@InputType()
export class ConfigOptionInput {
  @Field()
  name!: string

  @Field(() => Float)
  extraPrice!: number

  @Field({ nullable: true })
  available?: boolean
}

@InputType()
export class RecipeItemInput {
  @Field(() => ID)
  ingredientId!: string

  @Field(() => Float)
  quantity!: number
}

@InputType()
export class IngredientInput {
  @Field()
  name!: string

  @Field()
  unit!: string

  @Field({ nullable: true })
  active?: boolean
}

@InputType()
export class ProductInput {
  @Field(() => ID)
  categoryId!: string

  @Field()
  name!: string

  @Field()
  description!: string

  @Field(() => Float)
  price!: number

  @Field({ nullable: true })
  image?: string

  @Field({ nullable: true })
  available?: boolean
}

@InputType()
export class PromotionInput {
  @Field()
  name!: string

  @Field({ nullable: true })
  description?: string

  @Field()
  startDate!: string

  @Field()
  endDate!: string

  @Field({ nullable: true })
  active?: boolean
}

@InputType()
export class BranchInput {
  @Field()
  name!: string

  @Field()
  addressText!: string

  @Field(() => Float)
  latitude!: number

  @Field(() => Float)
  longitude!: number

  @Field({ nullable: true })
  phone?: string

  @Field({ nullable: true })
  active?: boolean
}

@InputType()
export class BranchHoursInput {
  @Field(() => Int)
  dayOfWeek!: number

  @Field({ nullable: true })
  opening?: string

  @Field({ nullable: true })
  closing?: string

  @Field()
  closed!: boolean
}

@InputType()
export class AddCartItemInput {
  @Field(() => ID)
  productId!: string

  @Field(() => Int)
  quantity!: number

  @Field({ nullable: true })
  observations?: string

  @Field(() => [ID], { nullable: true })
  optionIds?: string[]
}

@InputType()
export class UpdateCartItemInput {
  @Field(() => Int, { nullable: true })
  quantity?: number

  @Field({ nullable: true })
  observations?: string

  @Field(() => [ID], { nullable: true })
  optionIds?: string[]
}

@InputType()
export class AdjustStockInput {
  @Field(() => ID)
  branchId!: string

  @Field(() => ID)
  ingredientId!: string

  @Field(() => Float)
  delta!: number

  @Field()
  reason!: string
}

@InputType()
export class OrderStateInput {
  @Field()
  name!: string

  @Field(() => Int)
  order!: number

  @Field({ nullable: true })
  active?: boolean
}

@InputType()
export class ProductFilterInput {
  @Field(() => ID, { nullable: true })
  categoryId?: string

  @Field({ nullable: true })
  search?: string

  @Field({ nullable: true })
  available?: boolean
}

@InputType()
export class BranchFilterInput {
  @Field({ nullable: true })
  active?: boolean

  @Field({ nullable: true })
  search?: string
}

@InputType()
export class OrderFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  status?: OrderStatus

  @Field(() => ID, { nullable: true })
  branchId?: string

  @Field({ nullable: true })
  search?: string
}
