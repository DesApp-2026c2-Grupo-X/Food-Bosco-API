import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { VEHICLE_TYPE_VALUES } from '../config/constants'
import type { VehicleType } from '../config/constants'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedResult } from './seed.service'

class SeedVehicle {
  @IsEnum(VEHICLE_TYPE_VALUES)
  type!: VehicleType

  @IsOptional()
  @IsString()
  brand?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  plate?: string
}

class SeedBody {
  @IsString()
  @IsNotEmpty()
  userId!: string

  @IsString()
  @IsNotEmpty()
  firstName!: string

  @IsString()
  @IsNotEmpty()
  lastName!: string

  @IsString()
  @IsNotEmpty()
  phone!: string

  @IsOptional()
  @ValidateNested()
  @Type(() => SeedVehicle)
  vehicle?: SeedVehicle | null
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    return this.seedService.seedRiderProfile(body)
  }
}
