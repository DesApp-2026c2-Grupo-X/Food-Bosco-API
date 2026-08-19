import { Controller, Get } from '@nestjs/common'
import { HealthService } from './health.service'
import type { AuthHealth } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): AuthHealth {
    return this.healthService.getHealth()
  }
}
