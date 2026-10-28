import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsArray,
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

class SeedDeliveryAddressDto extends SeedLocationDto {
  @IsString()
  @IsNotEmpty()
  text!: string
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
  @Type(() => SeedDeliveryAddressDto)
  deliveryAddress!: SeedDeliveryAddressDto
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedReadyOrderDto)
  readyOrders?: SeedReadyOrderDto[]
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
