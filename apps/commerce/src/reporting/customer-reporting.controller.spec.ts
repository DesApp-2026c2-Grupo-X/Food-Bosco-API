import type { AuthContext } from '../config/security/jwt.service'
import { CustomerReportingController } from './customer-reporting.controller'
import type { CustomerReportingService } from './customer-reporting.service'
import type { CustomerReportQueryDto } from './dto/customer-report-query.dto'

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'client-1',
  roles: ['customer'],
  branchId: null,
  internal: false,
  ...overrides,
})

const makeController = () => {
  const service = { overview: jest.fn().mockResolvedValue({ period: {}, summary: {} }) }

  return {
    service,
    controller: new CustomerReportingController(service as unknown as CustomerReportingService),
  }
}

describe('CustomerReportingController', () => {
  it('consulta el reporte con el userId del token', async () => {
    const { controller, service } = makeController()

    await controller.overview(auth(), { groupBy: 'month' })

    expect(service.overview).toHaveBeenCalledWith('client-1', { groupBy: 'month' })
  })

  it('ignora cualquier identidad distinta al token', async () => {
    const { controller, service } = makeController()
    const query: CustomerReportQueryDto = {
      from: '2026-01-01T00:00:00.000Z',
      groupBy: 'day',
    }

    await controller.overview(auth({ userId: 'client-1' }), query)

    expect(service.overview).toHaveBeenCalledWith('client-1', query)
  })

  it('rechaza con 401 si el token no resuelve identidad', () => {
    const { controller, service } = makeController()

    expect(() => controller.overview(auth({ userId: null }), {})).toThrow('Identidad no resoluble')
    expect(service.overview).not.toHaveBeenCalled()
  })
})
