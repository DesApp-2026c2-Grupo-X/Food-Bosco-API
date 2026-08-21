import { Field, ObjectType } from '@nestjs/graphql'
import { asNumber, RawRecord } from './mappers'

@ObjectType()
export class GeoPoint {
  @Field()
  latitude!: number

  @Field()
  longitude!: number
}

export const mapGeoPoint = (raw: RawRecord | null | undefined): GeoPoint | null => {
  if (!raw) {
    return null
  }

  return { latitude: asNumber(raw.latitude), longitude: asNumber(raw.longitude) }
}
