import { Controller, Post } from '@nestjs/common'
import { Internal } from '../config/security/internal.decorator'
import { SeedService, type SeedResult } from './seed.service'

@Controller('v1/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @Internal()
  seed(): Promise<SeedResult> {
    return this.seedService.seed()
  }
}
