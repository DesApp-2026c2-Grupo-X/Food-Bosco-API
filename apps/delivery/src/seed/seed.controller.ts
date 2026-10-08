import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

import { Internal } from '../config/security/internal.decorator'

import { SeedService, type SeedResult } from './seed.service'

class SeedLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number
}

class SeedReadyOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string

  @IsString()
  @IsNotEmpty()
  branchId!: string

  @ValidateNested()
  @Type(() => SeedLocationDto)
  branchLocation!: SeedLocationDto

  @ValidateNested()
  @Type(() => SeedLocationDto)
  deliveryAddress!: SeedLocationDto & { text: string }
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
  @IsString()
  vehicle?: string | null

  @IsOptional()
  @IsBoolean()
  available?: boolean

  @IsOptional()
  @ValidateNested()
  @Type(() => SeedLocationDto)
  location?: SeedLocationDto

  @IsOptional()
  @ValidateNested()
  @Type(() => SeedReadyOrderDto)
  readyOrder?: SeedReadyOrderDto
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
