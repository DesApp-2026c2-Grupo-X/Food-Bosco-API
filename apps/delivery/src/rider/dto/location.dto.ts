import { IsLatitude, IsLongitude } from 'class-validator'

export class LocationDto {
  @IsLatitude()
  lat!: number

  @IsLongitude()
  lng!: number
}
