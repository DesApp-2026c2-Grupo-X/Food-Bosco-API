import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsInt,
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

class SeedCustomerDto {
  @IsString()
  @IsNotEmpty()
  id!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedAddressDto)
  addresses!: SeedAddressDto[]
}

class SeedDemoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  orders?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  days?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number

  @IsOptional()
  @IsBoolean()
  reset?: boolean
}

class SeedBody {
  @IsOptional()
  @ValidateNested()
  @Type(() => SeedOrderDto)
  order?: SeedOrderDto

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedCustomerDto)
  customers?: SeedCustomerDto[]

  @IsOptional()
  @ValidateNested()
  @Type(() => SeedDemoDto)
  demo?: SeedDemoDto
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    const order = body.order
      ? {
          client: { id: body.order.clientId },
          address: body.order.address,
        }
      : undefined

    return this.seedService.seed({
      order,
      customers: body.customers?.map((customer) => ({
        id: customer.id,
        addresses: customer.addresses,
      })),
      demo: body.demo,
    })
  }
}
