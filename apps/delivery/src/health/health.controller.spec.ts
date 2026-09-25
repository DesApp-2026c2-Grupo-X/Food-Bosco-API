import { HealthController } from './health.controller'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('reporta estado ok del servicio delivery', () => {
    const service = new HealthService()

    const health = service.getHealth()

    expect(health.status).toBe('ok')
    expect(health.service).toBe('delivery')
  })

  it('redondea hacia abajo el uptime del proceso', () => {
    const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(123.9)

    const health = new HealthService().getHealth()

    expect(health.uptimeSeconds).toBe(123)
    expect(Number.isInteger(health.uptimeSeconds)).toBe(true)
    uptimeSpy.mockRestore()
  })

  it('emite un timestamp ISO válido y cercano al presente', () => {
    const before = Date.now()

    const health = new HealthService().getHealth()

    const parsed = Date.parse(health.timestamp)
    expect(Number.isNaN(parsed)).toBe(false)
    expect(parsed).toBeGreaterThanOrEqual(before)
  })
})

describe('HealthController', () => {
  it('delega en HealthService y devuelve su resultado', () => {
    const payload = {
      status: 'ok' as const,
      service: 'delivery',
      uptimeSeconds: 10,
      timestamp: '2026-01-01T00:00:00.000Z',
    }
    const healthService = { getHealth: jest.fn().mockReturnValue(payload) }
    const controller = new HealthController(healthService as unknown as HealthService)

    expect(controller.getHealth()).toBe(payload)
    expect(healthService.getHealth).toHaveBeenCalledTimes(1)
  })
})
