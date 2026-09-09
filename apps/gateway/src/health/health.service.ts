import { Injectable } from '@nestjs/common'
import { env } from '../config/env'

export interface GatewayHealth {
  status: 'ok'
  service: string
  uptimeSeconds: number
  timestamp: string
  services: Record<string, string>
}

@Injectable()
export class HealthService {
  getHealth(): GatewayHealth {
    return {
      status: 'ok',
      service: 'gateway',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        auth: env.services.auth,
        commerce: env.services.commerce,
        delivery: env.services.delivery,
      },
    }
  }
}
