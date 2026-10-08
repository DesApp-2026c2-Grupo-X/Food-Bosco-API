import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
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

class SeedAddressDto {
  @IsString()
  @IsNotEmpty()
  id!: string

  @IsString()
  @IsNotEmpty()
  text!: string

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number
}

class SeedOrderDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string

  @ValidateNested()
  @Type(() => SeedAddressDto)
  address!: SeedAddressDto
}

class SeedBody {
  @IsOptional()
  @ValidateNested()
  @Type(() => SeedOrderDto)
  order?: SeedOrderDto
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    return this.seedService.seed(
      body.order
        ? {
            order: {
              client: { id: body.order.clientId },
              address: body.order.address,
            },
          }
        : {},
    )
  }
}
