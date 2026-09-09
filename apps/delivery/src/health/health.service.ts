import { Injectable } from '@nestjs/common'

export interface DeliveryHealth {
  status: 'ok'
  service: string
  uptimeSeconds: number
  timestamp: string
}

@Injectable()
export class HealthService {
  getHealth(): DeliveryHealth {
    return {
      status: 'ok',
      service: 'delivery',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
