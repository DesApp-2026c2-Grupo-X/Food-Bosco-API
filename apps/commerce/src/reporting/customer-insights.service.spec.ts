import type { CustomerInsightsAggregateRaw, ReportingRepository } from './reporting.repository'
import { CustomerInsightsService } from './customer-insights.service'

const NOW = new Date('2026-10-31T12:00:00.000Z')
const FROM = new Date('2026-10-01T00:00:00.000Z')
const TO = new Date('2026-10-31T23:59:59.999Z')

const day = (offset: number): Date => new Date(NOW.getTime() - offset * 24 * 60 * 60 * 1000)

const rawInsights = (
  overrides: Partial<CustomerInsightsAggregateRaw> = {},
): CustomerInsightsAggregateRaw => ({
  buyers: [],
  series: [],
  branchActivity: [],
  firstPurchases: [],
  platformFirstPurchases: [],
  ...overrides,
})

const makeService = (
  data: {
    overview?: CustomerInsightsAggregateRaw
    branchNames?: Map<string, string>
  } = {},
) => {
  const repository = {
    aggregateCustomerInsights: jest.fn().mockResolvedValue(data.overview ?? rawInsights()),
    listBranchNames: jest.fn().mockResolvedValue(data.branchNames ?? new Map()),
  }

  return {
    repository,
    service: new CustomerInsightsService(repository as unknown as ReportingRepository),
  }
}

describe('CustomerInsightsService.overview', () => {
  it('calcula KPIs de clientes únicos, nuevos y recurrentes', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 2,
            totalSpent: 600,
            firstPurchaseAt: day(10),
            lastPurchaseAt: day(2),
          },
          {
            _id: 'c2',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(5),
            lastPurchaseAt: day(5),
          },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.kpis).toEqual({
      totalBuyers: 2,
      newBuyers: 2,
      returningBuyers: 0,
      recurringBuyers: 1,
      totalOrders: 3,
      totalSpent: 700,
      averageTicket: 233.33,
      averageOrdersPerBuyer: 1.5,
    })
  })

  it('distingue cliente recurrente de cliente con una sola compra', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 3,
            totalSpent: 900,
            firstPurchaseAt: day(20),
            lastPurchaseAt: day(1),
          },
          {
            _id: 'c2',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(3),
            lastPurchaseAt: day(3),
          },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.customers.find((row) => row.clientId === 'c1')?.isRecurring).toBe(true)
    expect(result.customers.find((row) => row.clientId === 'c2')?.isRecurring).toBe(false)
    expect(result.kpis.recurringBuyers).toBe(1)
  })

  it('marca comprador nuevo solo si su primera compra del alcance cae en el período', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'new',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
          {
            _id: 'old',
            orders: 1,
            totalSpent: 200,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
        ],
        firstPurchases: [
          { _id: 'new', firstPurchaseAt: day(2) },
          { _id: 'old', firstPurchaseAt: new Date('2026-08-01T00:00:00.000Z') },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.customers.find((row) => row.clientId === 'new')?.isNew).toBe(true)
    expect(result.customers.find((row) => row.clientId === 'old')?.isNew).toBe(false)
    expect(result.kpis.newBuyers).toBe(1)
    expect(result.kpis.returningBuyers).toBe(1)
  })

  it('distingue nuevo en la sucursal de nuevo en la plataforma', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
        ],
        firstPurchases: [{ _id: 'c1', firstPurchaseAt: new Date('2026-09-15T00:00:00.000Z') }],
        platformFirstPurchases: [{ _id: 'c1', firstPurchaseAt: day(2) }],
      }),
    })

    const result = await service.overview(
      { from: FROM.toISOString(), to: TO.toISOString(), branchId: 'b1' },
      NOW,
    )

    expect(result.customers[0].isNew).toBe(false)
    expect(result.customers[0].isNewOnPlatform).toBe(true)
  })

  it('arma la evolución de compradores por período', async () => {
    const { service } = makeService({
      overview: rawInsights({
        series: [
          { _id: '2026-09', buyers: 3 },
          { _id: '2026-10', buyers: 5 },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.buyerSeries).toEqual([
      { bucket: '2026-09', buyers: 3 },
      { bucket: '2026-10', buyers: 5 },
    ])
  })

  it('distribuye clientes por cantidad de pedidos', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
          {
            _id: 'c2',
            orders: 2,
            totalSpent: 200,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
          {
            _id: 'c3',
            orders: 5,
            totalSpent: 500,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
          {
            _id: 'c4',
            orders: 7,
            totalSpent: 700,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(2),
          },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.frequency).toEqual([
      { bucket: '1', label: '1 pedido', buyers: 1 },
      { bucket: '2-3', label: '2 a 3 pedidos', buyers: 1 },
      { bucket: '4-5', label: '4 a 5 pedidos', buyers: 1 },
      { bucket: '6+', label: '6 o más pedidos', buyers: 1 },
    ])
  })

  it('distribuye clientes por tiempo desde la última compra con límites inclusivos', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(30),
            lastPurchaseAt: day(7),
          },
          {
            _id: 'c2',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(30),
            lastPurchaseAt: day(8),
          },
          {
            _id: 'c3',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(60),
            lastPurchaseAt: day(31),
          },
          {
            _id: 'c4',
            orders: 1,
            totalSpent: 100,
            firstPurchaseAt: day(90),
            lastPurchaseAt: day(91),
          },
        ],
      }),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.recency).toEqual([
      { bucket: '0-7', label: 'Últimos 7 días', buyers: 1 },
      { bucket: '8-30', label: '8 a 30 días', buyers: 1 },
      { bucket: '31-90', label: '31 a 90 días', buyers: 1 },
      { bucket: '90+', label: 'Más de 90 días', buyers: 1 },
    ])
  })

  it('ordena el listado por pedidos y aplica el límite', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 1,
            totalSpent: 900,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(5),
          },
          {
            _id: 'c2',
            orders: 4,
            totalSpent: 100,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(1),
          },
          {
            _id: 'c3',
            orders: 2,
            totalSpent: 500,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(3),
          },
        ],
      }),
    })

    const result = await service.overview(
      { from: FROM.toISOString(), to: TO.toISOString(), sortBy: 'orders', limit: 2 },
      NOW,
    )

    expect(result.customers.map((row) => row.clientId)).toEqual(['c2', 'c3'])
  })

  it('ordena por gasto cuando se solicita', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 1,
            totalSpent: 900,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(5),
          },
          {
            _id: 'c2',
            orders: 4,
            totalSpent: 100,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(1),
          },
          {
            _id: 'c3',
            orders: 2,
            totalSpent: 500,
            firstPurchaseAt: day(2),
            lastPurchaseAt: day(3),
          },
        ],
      }),
    })

    const result = await service.overview(
      { from: FROM.toISOString(), to: TO.toISOString(), sortBy: 'spent' },
      NOW,
    )

    expect(result.customers.map((row) => row.clientId)).toEqual(['c1', 'c3', 'c2'])
  })

  it('resuelve el nombre de cada sucursal en la distribución', async () => {
    const { service } = makeService({
      overview: rawInsights({
        branchActivity: [{ _id: 'b1', buyers: 2, orders: 3, totalSpent: 700 }],
      }),
      branchNames: new Map([['b1', 'Centro']]),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.branchActivity).toEqual([
      { branchId: 'b1', branchName: 'Centro', buyers: 2, orders: 3, totalSpent: 700 },
    ])
  })

  it('no duplica el total global cuando un cliente compra en varias sucursales', async () => {
    const { service } = makeService({
      overview: rawInsights({
        buyers: [
          {
            _id: 'c1',
            orders: 2,
            totalSpent: 700,
            firstPurchaseAt: day(10),
            lastPurchaseAt: day(2),
          },
        ],
        branchActivity: [
          { _id: 'b1', buyers: 1, orders: 1, totalSpent: 300 },
          { _id: 'b2', buyers: 1, orders: 1, totalSpent: 400 },
        ],
      }),
      branchNames: new Map([
        ['b1', 'Centro'],
        ['b2', 'Norte'],
      ]),
    })

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.kpis.totalBuyers).toBe(1)
    expect(result.branchActivity).toHaveLength(2)
    expect(result.branchActivity.map((row) => row.branchName)).toEqual(['Centro', 'Norte'])
  })

  it('sin compradores devuelve KPIs en cero y distribuciones vacías', async () => {
    const { service } = makeService()

    const result = await service.overview({ from: FROM.toISOString(), to: TO.toISOString() }, NOW)

    expect(result.kpis).toEqual({
      totalBuyers: 0,
      newBuyers: 0,
      returningBuyers: 0,
      recurringBuyers: 0,
      totalOrders: 0,
      totalSpent: 0,
      averageTicket: 0,
      averageOrdersPerBuyer: 0,
    })
    expect(result.customers).toEqual([])
    expect(result.frequency.every((row) => row.buyers === 0)).toBe(true)
    expect(result.recency.every((row) => row.buyers === 0)).toBe(true)
  })

  it('usa por defecto los últimos 30 días agrupados por mes y 100 filas', async () => {
    const { repository, service } = makeService()

    const result = await service.overview({}, NOW)

    const from = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(result.period).toEqual({ from: from.toISOString(), to: NOW.toISOString() })
    expect(repository.aggregateCustomerInsights).toHaveBeenCalledWith({
      from,
      to: NOW,
      branchId: undefined,
      groupBy: 'month',
      sortBy: 'last_purchase',
      limit: 100,
    })
  })

  it('propaga el filtro de sucursal al repositorio', async () => {
    const { repository, service } = makeService()

    await service.overview(
      { from: FROM.toISOString(), to: TO.toISOString(), branchId: 'b2', groupBy: 'week' },
      NOW,
    )

    expect(repository.aggregateCustomerInsights).toHaveBeenCalledWith({
      from: FROM,
      to: TO,
      branchId: 'b2',
      groupBy: 'week',
      sortBy: 'last_purchase',
      limit: 100,
    })
  })

  const invalidRanges = [
    {
      name: 'rango invertido',
      query: { from: '2026-10-02T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
    },
    { name: 'fecha inválida', query: { from: 'no-es-fecha' } },
  ]

  it.each(invalidRanges)('$name → 400', async ({ query }) => {
    const { service } = makeService()

    await expect(service.overview(query, NOW)).rejects.toThrow('Rango de fechas inválido')
  })
})
