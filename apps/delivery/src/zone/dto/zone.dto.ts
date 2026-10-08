import { IsBoolean, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator'
import { Transform, Type } from 'class-transformer'

type BooleanInput = boolean | string | number

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
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  active!: boolean
}
