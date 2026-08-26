import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql'
import { GeoPoint } from '../common/geo-point'
import { OrderStatus, orderStatusFromRest } from '../common/order-status.enum'
import { TripStatus, tripStatusFromRest } from '../common/trip-status.enum'
import {
  asBoolean,
  asNumber,
  asRecordList,
  asString,
  idOf,
  nullableNumber,
  nullableString,
} from '../common/mappers'
import type { RawRecord } from '../common/mappers'

@ObjectType()
export class Rider {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  userId!: string

  @Field(() => String, { nullable: true })
  firstName!: string | null

  @Field(() => String, { nullable: true })
  lastName!: string | null

  @Field(() => String, { nullable: true })
  vehicle!: string | null

  @Field(() => String, { nullable: true })
  phone!: string | null

  @Field()
  available!: boolean

  @Field(() => GeoPoint, { nullable: true })
  currentLocation!: GeoPoint | null
}

@ObjectType()
export class TripAddress {
  @Field()
  text!: string

  @Field()
  latitude!: number

  @Field()
  longitude!: number
}

@ObjectType()
export class TripOrder {
  @Field(() => ID)
  orderId!: string

  @Field(() => ID)
  pickupBranchId!: string

  @Field(() => GeoPoint)
  pickupLocation!: GeoPoint

  @Field(() => TripAddress)
  deliveryAddress!: TripAddress

  @Field(() => OrderStatus)
  status!: OrderStatus

  @Field(() => String, { nullable: true })
  pickedUpAt!: string | null

  @Field(() => String, { nullable: true })
  deliveredAt!: string | null
}

@ObjectType()
export class TripOffer {
  @Field(() => ID)
  id!: string

  @Field(() => Int)
  orderCount!: number

  @Field(() => Float)
  distanceKm!: number

  @Field(() => Int)
  estimatedMinutes!: number

  @Field(() => Float)
  estimatedEarnings!: number

  @Field(() => String, { nullable: true })
  expiresAt!: string | null
}

@ObjectType()
export class Trip {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  riderId!: string

  @Field(() => TripStatus)
  status!: TripStatus

  @Field(() => [TripOrder])
  orders!: TripOrder[]

  @Field(() => Float)
  distanceKm!: number

  @Field(() => Int)
  estimatedMinutes!: number

  @Field(() => Float)
  estimatedEarnings!: number

  @Field(() => Float, { nullable: true })
  earnings!: number | null

  @Field(() => String, { nullable: true })
  startedAt!: string | null

  @Field(() => String, { nullable: true })
  completedAt!: string | null

  @Field(() => String, { nullable: true })
  expiresAt!: string | null
}

const mapGeoPoint = (raw: RawRecord | null | undefined): GeoPoint => ({
  latitude: asNumber(raw?.latitude),
  longitude: asNumber(raw?.longitude),
})

const mapTripAddress = (raw: RawRecord | null | undefined): TripAddress => ({
  text: asString(raw?.text),
  latitude: asNumber(raw?.latitude),
  longitude: asNumber(raw?.longitude),
})

export const mapRider = (raw: RawRecord): Rider => ({
  id: idOf(raw),
  userId: asString(raw.userId),
  firstName: nullableString(raw.firstName),
  lastName: nullableString(raw.lastName),
  vehicle: nullableString(raw.vehicle),
  phone: nullableString(raw.phone),
  available: asBoolean(raw.available),
  currentLocation: raw.currentLocation ? mapGeoPoint(raw.currentLocation as RawRecord) : null,
})

export const mapTripOrder = (raw: RawRecord): TripOrder => ({
  orderId: asString(raw.orderId),
  pickupBranchId: asString(raw.pickupBranchId),
  pickupLocation: mapGeoPoint(raw.pickupLocation as RawRecord),
  deliveryAddress: mapTripAddress(raw.deliveryAddress as RawRecord),
  status: orderStatusFromRest(asString(raw.status)),
  pickedUpAt: nullableString(raw.pickedUpAt),
  deliveredAt: nullableString(raw.deliveredAt),
})

export const mapTripOffer = (raw: RawRecord): TripOffer => ({
  id: idOf(raw),
  orderCount: asNumber(raw.orderCount),
  distanceKm: asNumber(raw.distanceKm),
  estimatedMinutes: asNumber(raw.estimatedMinutes),
  estimatedEarnings: asNumber(raw.estimatedEarnings),
  expiresAt: nullableString(raw.expiresAt),
})

export const mapTrip = (raw: RawRecord): Trip => ({
  id: idOf(raw),
  riderId: asString(raw.riderId),
  status: tripStatusFromRest(asString(raw.status)),
  orders: asRecordList(raw.orders).map(mapTripOrder),
  distanceKm: asNumber(raw.distanceKm),
  estimatedMinutes: asNumber(raw.estimatedMinutes),
  estimatedEarnings: asNumber(raw.estimatedEarnings),
  earnings: nullableNumber(raw.earnings),
  startedAt: nullableString(raw.startedAt),
  completedAt: nullableString(raw.completedAt),
  expiresAt: nullableString(raw.expiresAt),
})
