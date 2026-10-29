import {
  IsBoolean,
  IsDefined,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'

type BooleanInput = boolean | string | number

class GeoPointDto {
  @IsLatitude()
  latitude!: number

  @IsLongitude()
  longitude!: number
}

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  center!: GeoPointDto

  @IsNumber()
  @IsPositive()
  radiusKm!: number
}

export class SetActiveDto {
  @Transform(({ obj, key }): BooleanInput => obj[key] as BooleanInput)
  @IsBoolean()
  active!: boolean
}
