import type { CustomerOverviewAggregateRaw, ReportingRepository } from './reporting.repository'
import { CustomerReportingService } from './customer-reporting.service'

const rawOverview = (
  overrides: Partial<CustomerOverviewAggregateRaw> = {},
): CustomerOverviewAggregateRaw => ({
  summary: [],
  status: [],
  series: [],
  frequentProducts: [],
  branches: [],
  ...overrides,
})

const makeService = (
  data: {
    overview?: CustomerOverviewAggregateRaw
    branchNames?: Map<string, string>
  } = {},
) => {
  const repository = {
    aggregateCustomerOverview: jest.fn().mockResolvedValue(data.overview ?? rawOverview()),
    listBranchNames: jest.fn().mockResolvedValue(data.branchNames ?? new Map()),
  }

  return {
    repository,
    service: new CustomerReportingService(repository as unknown as ReportingRepository),
  }
}

const NOW = new Date('2026-10-01T00:00:00.000Z')

describe('CustomerReportingService.overview (RQ-REP-CLIENTE)', () => {
  it('calcula el resumen y el ticket promedio sobre pedidos entregados', async () => {
    const { service } = makeService({
      overview: rawOverview({
        summary: [
          {
            totalOrders: 5,
            completedOrders: 3,
            cancelledOrders: 1,
            activeOrders: 1,
            totalSpent: 1000,
          },
        ],
      }),
    })

    const result = await service.overview('client-1', {}, NOW)

    expect(result.summary).toMatchObject({
      totalOrders: 5,
      completedOrders: 3,
      cancelledOrders: 1,
      activeOrders: 1,
      totalSpent: 1000,
      averageTicket: 333.33,
      favoriteBranch: null,
    })
  })

  it('expone la serie de actividad y los productos frecuentes mapeados', async () => {
    const { service } = makeService({
      overview: rawOverview({
        series: [
          { _id: '2026-09', orders: 4, completedOrders: 2, totalSpent: 700 },
          { _id: '2026-10', orders: 1, completedOrders: 1, totalSpent: 300 },
        ],
        frequentProducts: [
          { _id: 'p1', name: 'Hamburguesa', quantity: 6, orders: 3, totalSpent: 900 },
        ],
      }),
    })

    const result = await service.overview('client-1', {}, NOW)

    expect(result.activitySeries).toEqual([
      { bucket: '2026-09', orders: 4, completedOrders: 2, totalSpent: 700 },
      { bucket: '2026-10', orders: 1, completedOrders: 1, totalSpent: 300 },
    ])
    expect(result.frequentProducts).toEqual([
      { productId: 'p1', name: 'Hamburguesa', quantity: 6, orders: 3, totalSpent: 900 },
    ])
  })

  it('completa los siete estados con 0 cuando faltan datos', async () => {
    const { service } = makeService({
      overview: rawOverview({ status: [{ _id: 'delivered', count: 2 }] }),
    })

    const result = await service.overview('client-1', {}, NOW)

    expect(result.ordersByStatus).toHaveLength(7)
    expect(result.ordersByStatus.find((row) => row.status === 'delivered')?.count).toBe(2)
    expect(result.ordersByStatus.find((row) => row.status === 'cancelled')?.count).toBe(0)
  })

  it('resuelve el nombre de la sucursal favorita', async () => {
    const { repository, service } = makeService({
      overview: rawOverview({
        branches: [{ _id: 'b1', orders: 4, totalSpent: 900 }],
      }),
      branchNames: new Map([['b1', 'Centro']]),
    })

    const result = await service.overview('client-1', {}, NOW)

    expect(repository.listBranchNames).toHaveBeenCalledWith(['b1'])
    expect(result.summary.favoriteBranch).toEqual({
      branchId: 'b1',
      branchName: 'Centro',
      orders: 4,
      totalSpent: 900,
    })
  })

  it('sin pedidos devuelve ceros, listas vacías y sin sucursal favorita', async () => {
    const { service } = makeService()

    const result = await service.overview('client-1', {}, NOW)

    expect(result.summary).toEqual({
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      activeOrders: 0,
      totalSpent: 0,
      averageTicket: 0,
      favoriteBranch: null,
    })
    expect(result.activitySeries).toEqual([])
    expect(result.frequentProducts).toEqual([])
    expect(result.ordersByStatus).toHaveLength(7)
  })

  it('usa por defecto los últimos 365 días agrupados por mes', async () => {
    const { repository, service } = makeService()

    const result = await service.overview('client-1', {}, NOW)

    const from = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000)
    expect(result.period).toEqual({ from: from.toISOString(), to: NOW.toISOString() })
    expect(repository.aggregateCustomerOverview).toHaveBeenCalledWith('client-1', {
      from,
      to: NOW,
      groupBy: 'month',
    })
  })

  it('respeta el rango y la agrupación solicitados', async () => {
    const { repository, service } = makeService()

    await service.overview(
      'client-1',
      { from: '2026-01-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z', groupBy: 'week' },
      NOW,
    )

    expect(repository.aggregateCustomerOverview).toHaveBeenCalledWith('client-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-03-31T23:59:59.999Z'),
      groupBy: 'week',
    })
  })

  it('siempre consulta con el clientId recibido del contexto', async () => {
    const { repository, service } = makeService()

    await service.overview('client-1', {}, NOW)

    expect(repository.aggregateCustomerOverview.mock.calls[0][0]).toBe('client-1')
  })

  const invalidRanges = [
    {
      name: 'rango invertido',
      query: { from: '2026-10-02T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
    },
  ]

  it.each(invalidRanges)('$name → 400', async ({ query }) => {
    const { service } = makeService()

    await expect(service.overview('client-1', query, NOW)).rejects.toThrow(
      'Rango de fechas inválido',
    )
  })

  const identities = [
    { name: 'cliente vacío', clientId: '' },
    { name: 'cliente nulo', clientId: null },
  ]

  it.each(identities)('$name → 401 sin consultar la base', async ({ clientId }) => {
    const { repository, service } = makeService()

    await expect(service.overview(clientId as unknown as string, {}, NOW)).rejects.toThrow(
      'Identidad no resoluble',
    )
    expect(repository.aggregateCustomerOverview).not.toHaveBeenCalled()
  })
})
