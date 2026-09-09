import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { VEHICLE_TYPE_VALUES } from '../../config/constants'
import type { VehicleType } from '../../config/constants'

export class UpdateVehicleDto {
  @IsEnum(VEHICLE_TYPE_VALUES)
  type!: VehicleType

  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plate?: string
}
