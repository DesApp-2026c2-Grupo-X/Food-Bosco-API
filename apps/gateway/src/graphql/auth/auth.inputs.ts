import { Field, ID, InputType } from '@nestjs/graphql'
import { Role } from '../common/role.enum'

@InputType()
export class RegisterInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  email!: string

  @Field()
  phone!: string

  @Field()
  password!: string
}

@InputType()
export class RegisterRiderInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  email!: string

  @Field()
  phone!: string

  @Field()
  password!: string

  @Field()
  vehicle!: string
}

@InputType()
export class LoginInput {
  @Field()
  email!: string

  @Field()
  password!: string
}

@InputType()
export class UpdateProfileInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  phone!: string
}

@InputType()
export class CreateStaffInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  email!: string

  @Field()
  phone!: string

  @Field()
  password!: string

  @Field(() => ID)
  branchId!: string
}

@InputType()
export class CreateAdminInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  email!: string

  @Field()
  phone!: string

  @Field()
  password!: string
}

@InputType()
export class CreateRiderInput {
  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field()
  email!: string

  @Field()
  phone!: string

  @Field()
  password!: string

  @Field()
  vehicle!: string
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  firstName?: string

  @Field({ nullable: true })
  lastName?: string

  @Field({ nullable: true })
  phone?: string

  @Field(() => ID, { nullable: true })
  branchId?: string
}

@InputType()
export class CreateAddressInput {
  @Field()
  label!: string

  @Field()
  text!: string

  @Field({ nullable: true })
  city?: string

  @Field({ nullable: true })
  postalCode?: string

  @Field()
  latitude!: number

  @Field()
  longitude!: number
}

@InputType()
export class UpdateAddressInput {
  @Field({ nullable: true })
  label?: string

  @Field({ nullable: true })
  text?: string

  @Field({ nullable: true })
  city?: string

  @Field({ nullable: true })
  postalCode?: string

  @Field({ nullable: true })
  latitude?: number

  @Field({ nullable: true })
  longitude?: number
}

@InputType()
export class UserFilterInput {
  @Field(() => Role, { nullable: true })
  role?: Role

  @Field({ nullable: true })
  active?: boolean

  @Field({ nullable: true })
  search?: string
}
