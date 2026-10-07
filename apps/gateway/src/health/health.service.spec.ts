import { env } from '../config/env'
import { HealthService } from './health.service'

describe('Gateway HealthService', () => {
  it('reporta estado ok, servicio y las URLs de los servicios downstream', () => {
    const health = new HealthService().getHealth()

    expect(health.status).toBe('ok')
    expect(health.service).toBe('gateway')
    expect(health.services).toEqual({
      auth: env.services.auth,
      commerce: env.services.commerce,
      delivery: env.services.delivery,
    })
    expect(typeof health.uptimeSeconds).toBe('number')
    expect(Number.isNaN(new Date(health.timestamp).getTime())).toBe(false)
  })
})
