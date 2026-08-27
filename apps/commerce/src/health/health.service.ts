import { Injectable } from '@nestjs/common'

export interface CommerceHealth {
  status: 'ok'
  service: string
  uptimeSeconds: number
  timestamp: string
}

@Injectable()
export class HealthService {
  getHealth(): CommerceHealth {
    return {
      status: 'ok',
      service: 'commerce',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
