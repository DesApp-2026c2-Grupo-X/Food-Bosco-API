import { Field, ID, ObjectType } from '@nestjs/graphql'
import { PageInfo } from '../common/page'
import { Role, roleFromRest } from '../common/role.enum'

type RawRecord = Record<string, unknown>

const asString = (value: unknown): string => (value == null ? '' : String(value))

const nullableString = (value: unknown): string | null => (value == null ? null : String(value))

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string

  @Field()
  email!: string

  @Field()
  firstName!: string

  @Field()
  lastName!: string

  @Field(() => String, { nullable: true })
  phone!: string | null

  @Field(() => Role)
  role!: Role

  @Field()
  active!: boolean

  @Field(() => ID, { nullable: true })
  branchId!: string | null

  @Field(() => String, { nullable: true })
  vehicle!: string | null
}

@ObjectType()
export class Address {
  @Field(() => ID)
  id!: string

  @Field()
  label!: string

  @Field()
  text!: string

  @Field(() => String, { nullable: true })
  city!: string | null

  @Field(() => String, { nullable: true })
  postalCode!: string | null

  @Field()
  latitude!: number

  @Field()
  longitude!: number

  @Field()
  active!: boolean
}

@ObjectType()
export class AuthTokens {
  @Field()
  accessToken!: string

  @Field()
  refreshToken!: string
}

@ObjectType()
export class UserPage {
  @Field(() => [User])
  data!: User[]

  @Field(() => PageInfo)
  pageInfo!: PageInfo
}

export const mapUser = (raw: RawRecord): User => ({
  id: asString(raw.id ?? raw._id),
  email: asString(raw.email),
  firstName: asString(raw.firstName),
  lastName: asString(raw.lastName),
  phone: nullableString(raw.phone),
  role: roleFromRest(asString(raw.role)),
  active: Boolean(raw.active),
  branchId: nullableString(raw.branchId),
  vehicle: nullableString(raw.vehicle),
})

export const mapAddress = (raw: RawRecord): Address => ({
  id: asString(raw.id ?? raw._id),
  label: asString(raw.label),
  text: asString(raw.text),
  city: nullableString(raw.city),
  postalCode: nullableString(raw.postalCode),
  latitude: Number(raw.latitude),
  longitude: Number(raw.longitude),
  active: Boolean(raw.active),
})
