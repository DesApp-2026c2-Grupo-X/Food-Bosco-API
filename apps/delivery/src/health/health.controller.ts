import { Controller, Get } from '@nestjs/common'
import { HealthService } from './health.service'
import type { DeliveryHealth } from './health.service'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): DeliveryHealth {
    return this.healthService.getHealth()
  }
}
