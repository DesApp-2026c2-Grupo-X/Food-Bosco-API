import { Test } from '@nestjs/testing'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

describe('HealthController', () => {
  let controller: HealthController

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile()

    controller = moduleRef.get(HealthController)
  })

  it('devuelve estado ok con los servicios configurados', () => {
    const result = controller.getHealth()

    expect(result.status).toBe('ok')
    expect(result.service).toBe('gateway')
    expect(Object.keys(result.services)).toEqual(['auth', 'commerce', 'delivery'])
  })
})
