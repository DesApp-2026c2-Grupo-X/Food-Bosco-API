import type { AuthContext } from '../config/security/jwt.service'
import { CustomerInsightsController } from './customer-insights.controller'
import type { CustomerInsightsService } from './customer-insights.service'
import type { CustomerInsightsQueryDto } from './dto/customer-insights-query.dto'

const auth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  authenticated: true,
  userId: 'admin-1',
  roles: ['branch_admin'],
  branchId: 'b1',
  internal: false,
  ...overrides,
})

const makeController = () => {
  const service = { overview: jest.fn().mockResolvedValue({ period: {}, kpis: {} }) }

  return {
    service,
    controller: new CustomerInsightsController(service as unknown as CustomerInsightsService),
  }
}

describe('CustomerInsightsController - aislamiento por sucursal', () => {
  it('fuerza la sucursal del token para el administrador de sucursal', async () => {
    const { controller, service } = makeController()

    await controller.insights(auth({ branchId: 'b1' }), {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
      branchId: 'b2',
    })

    expect(service.overview).toHaveBeenCalledWith({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.999Z',
      branchId: 'b1',
    })
  })

  it('rechaza con 403 al administrador de sucursal sin sucursal asignada', () => {
    const { controller, service } = makeController()

    expect(() =>
      controller.insights(auth({ branchId: null }), {} as CustomerInsightsQueryDto),
    ).toThrow('Sin sucursal asignada')
    expect(service.overview).not.toHaveBeenCalled()
  })

  it('permite al administrador general consultar la sucursal solicitada', async () => {
    const { controller, service } = makeController()

    await controller.insights(auth({ roles: ['super_admin'], branchId: null }), {
      branchId: 'b2',
      sortBy: 'spent',
      limit: 50,
    })

    expect(service.overview).toHaveBeenCalledWith({
      branchId: 'b2',
      sortBy: 'spent',
      limit: 50,
    })
  })

  it('permite al administrador general consultar todas las sucursales', async () => {
    const { controller, service } = makeController()

    await controller.insights(auth({ roles: ['super_admin'], branchId: null }), {})

    expect(service.overview).toHaveBeenCalledWith({ branchId: undefined })
  })
})
