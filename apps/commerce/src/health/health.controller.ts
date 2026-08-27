import { Controller, Get } from '@nestjs/common'
import { HealthService } from './health.service'
import type { CommerceHealth } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): CommerceHealth {
    return this.healthService.getHealth()
  }
}
