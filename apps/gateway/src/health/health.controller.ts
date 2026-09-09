import { Controller, Get } from '@nestjs/common'
import { HealthService } from './health.service'
import type { GatewayHealth } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): GatewayHealth {
    return this.healthService.getHealth()
  }
}
