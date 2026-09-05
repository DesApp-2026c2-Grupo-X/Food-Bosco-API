import { Body, Controller, Post } from '@nestjs/common'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedResult } from './seed.service'

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
