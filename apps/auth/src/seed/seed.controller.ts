import { Body, Controller, Post } from '@nestjs/common'
import { IsOptional, IsString } from 'class-validator'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedResult } from './seed.service'

class SeedBody {
  @IsOptional()
  @IsString()
  branchId?: string
}

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(@Body() body: SeedBody): Promise<SeedResult> {
    return this.seedService.seed(body.branchId)
  }
}
