import { IsBoolean, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class GeoPointDto {
  @IsNumber()
  latitude!: number

  @IsNumber()
  longitude!: number
}

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @ValidateNested()
  @Type(() => GeoPointDto)
  center!: GeoPointDto

  @IsNumber()
  radiusKm!: number
}

export class SetActiveDto {
  @IsBoolean()
  active!: boolean
}
