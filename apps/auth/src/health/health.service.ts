import { Injectable } from '@nestjs/common'

export interface AuthHealth {
  status: 'ok'
  service: string
  uptimeSeconds: number
  timestamp: string
}

@Injectable()
export class HealthService {
  getHealth(): AuthHealth {
    return {
      status: 'ok',
      service: 'auth',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
