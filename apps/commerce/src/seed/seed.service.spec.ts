import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { IngredientService } from '../ingredient/ingredient.service'
import { OrderService } from '../order/order.service'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import { StockService } from '../stock/stock.service'
import { DemoOrdersRepository } from './demo/demo-orders.repository'
import { SeedService } from './seed.service'

const existingEntity = (overrides: Record<string, unknown> = {}) => overrides

const buildMocks = (overrides: Record<string, unknown> = {}) => ({
  orderStateService: { findByCode: jest.fn().mockResolvedValue(null), upsertByCode: jest.fn() },
  parameterService: { findByKey: jest.fn().mockResolvedValue(null), upsertByKey: jest.fn() },
  categoryService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    upsertByName: jest.fn().mockImplementation(async (name: string) => ({ id: `c-${name}`, name })),
  },
  ingredientService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    upsertByName: jest.fn().mockImplementation(async (seed: { name: string }) => ({
      id: `i-${seed.name}`,
      name: seed.name,
    })),
    update: jest.fn().mockResolvedValue(null),
  },
  branchService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    upsertByName: jest.fn().mockImplementation(async (seed: { name: string }) => ({
      id: `b-${seed.name}`,
      name: seed.name,
      latitude: -34.59,
      longitude: -58.63,
      active: true,
      hours: [],
    })),
    updateHours: jest.fn().mockResolvedValue(null),
    findById: jest
      .fn()
      .mockResolvedValue({ id: 'b-Centro', name: 'Centro', latitude: -34.589, longitude: -58.636 }),
  },
  productService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    create: jest
      .fn()
      .mockImplementation(async (seed: { name: string }) => ({ id: `p-${seed.name}` })),
    addConfigGroup: jest.fn().mockResolvedValue({ id: 'g' }),
    addConfigOption: jest.fn().mockResolvedValue(undefined),
    setRecipe: jest.fn().mockResolvedValue(undefined),
  },
  promotionService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    upsertByName: jest.fn().mockResolvedValue(undefined),
  },
  stockService: {
    list: jest.fn().mockResolvedValue([]),
    adjust: jest.fn().mockResolvedValue(undefined),
  },
  orderService: {
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, limit: 500, offset: 0 } }),
    create: jest.fn().mockImplementation(async (_input: { clientId: string }) => ({
      id: 'o-1',
      number: '000001',
    })),
    applyTransition: jest.fn().mockResolvedValue({ changed: true }),
  },
  demoOrdersRepository: {
    count: jest.fn().mockResolvedValue(0),
    insert: jest
      .fn()
      .mockImplementation(
        async (planned: { status: string; branchId: string; createdAt: Date }[]) =>
          planned.map((order, index) => ({
            id: `demo-${index}`,
            number: String(index + 1).padStart(6, '0'),
            status: order.status,
            branchId: order.branchId,
            deliveryAddress: { text: 'Calle 1', latitude: -34.59, longitude: -58.63 },
            createdAt: order.createdAt,
          })),
      ),
    resetDemoData: jest.fn().mockResolvedValue(0),
  },
  ...overrides,
})

const instantiate = (mocks: ReturnType<typeof buildMocks>) =>
  new SeedService(
    mocks.orderStateService as unknown as OrderStateService,
    mocks.parameterService as unknown as ParameterService,
    mocks.categoryService as unknown as CategoryService,
    mocks.ingredientService as unknown as IngredientService,
    mocks.branchService as unknown as BranchService,
    mocks.productService as unknown as ProductService,
    mocks.promotionService as unknown as PromotionService,
    mocks.stockService as unknown as StockService,
    mocks.orderService as unknown as OrderService,
    mocks.demoOrdersRepository as unknown as DemoOrdersRepository,
  )

describe('SeedService (commerce)', () => {
  it('crea sucursales y setea horarios configurables de 7 días', async () => {
    const mocks = buildMocks()
    const service = instantiate(mocks)

    const result = await service.seed()

    expect(mocks.branchService.updateHours).toHaveBeenCalledTimes(3)
    for (const call of mocks.branchService.updateHours.mock.calls) {
      const hours = call[1]
      expect(hours).toHaveLength(7)
      expect(hours.filter((entry: { closed: boolean }) => entry.closed === false)).toHaveLength(7)
    }
    expect(result.branches).toHaveLength(3)
    expect(result.summary.branches).toBe(3)
    expect(result.summary.categories).toBe(5)
  })

  it('es idempotente: no re-setea horarios de sucursales ya existentes', async () => {
    const existingBranches = [
      existingEntity({ id: 'b1', name: 'Centro', hours: [{ dayOfWeek: 1 }] }),
      existingEntity({ id: 'b2', name: 'Norte', hours: [{ dayOfWeek: 1 }] }),
      existingEntity({ id: 'b3', name: 'Oeste', hours: [{ dayOfWeek: 1 }] }),
    ]
    const mocks = buildMocks({
      branchService: {
        list: jest.fn().mockResolvedValue({ data: existingBranches }),
        upsertByName: jest
          .fn()
          .mockImplementation(async (seed: { name: string }) =>
            existingBranches.find((branch) => branch.name === seed.name),
          ),
        updateHours: jest.fn(),
      },
    })
    const service = instantiate(mocks)

    const result = await service.seed()

    expect(mocks.branchService.upsertByName).toHaveBeenCalledTimes(3)
    expect(mocks.branchService.updateHours).not.toHaveBeenCalled()
    expect(result.branches).toHaveLength(3)
  })

  it('es idempotente: no vuelve a crear catálogo que ya existe y actualiza minQuantity si estaba en 0', async () => {
    const mocks = buildMocks({
      categoryService: {
        list: jest.fn().mockResolvedValue({
          data: ['Hamburguesas', 'Pizzas', 'Acompañamientos', 'Bebidas', 'Postres'].map((name) => ({
            id: `c-${name}`,
            name,
          })),
        }),
        upsertByName: jest.fn(),
      },
      ingredientService: {
        list: jest.fn().mockResolvedValue({
          data: [
            { id: 'i-papa', name: 'Papa', unit: 'kg', minQuantity: 0, active: true },
            { id: 'i-agua', name: 'Agua', unit: 'botella', minQuantity: 25, active: true },
          ],
        }),
        upsertByName: jest.fn().mockImplementation(async (seed: { name: string }) => ({
          id: `i-${seed.name}`,
          name: seed.name,
        })),
        update: jest.fn().mockResolvedValue(null),
      },
    })
    const service = instantiate(mocks)

    const result = await service.seed()

    expect(mocks.categoryService.upsertByName).not.toHaveBeenCalled()
    expect(mocks.ingredientService.update).toHaveBeenCalledWith('i-papa', { minQuantity: 5 })
    expect(mocks.ingredientService.update).not.toHaveBeenCalledWith('i-agua', expect.anything())
    expect(result.summary.categories).toBe(5)
  })

  describe('pedidos demo', () => {
    const configGroup = (
      id: string,
      name: string,
      options: { id: string; name: string; extraPrice: number }[],
    ) => ({ id, name, options })

    const stubbedProducts = [
      {
        id: 'p-clasica',
        name: 'Hamburguesa Clásica',
        price: 6500,
        available: true,
        configGroups: [
          configGroup('g1', 'Tamaño', [
            { id: 'op-simple', name: 'Simple', extraPrice: 0 },
            { id: 'op-doble', name: 'Doble', extraPrice: 1500 },
          ]),
          configGroup('g2', 'Extras', [{ id: 'op-queso', name: 'Queso extra', extraPrice: 800 }]),
        ],
      },
      {
        id: 'p-papas',
        name: 'Papas Fritas',
        price: 3200,
        available: true,
        configGroups: [
          configGroup('g3', 'Tamaño', [{ id: 'op-grande', name: 'Grande', extraPrice: 900 }]),
        ],
      },
      {
        id: 'p-mozza',
        name: 'Pizza Mozzarella',
        price: 7800,
        available: true,
        configGroups: [
          configGroup('g4', 'Tamaño', [{ id: 'op-g', name: 'Grande', extraPrice: 0 }]),
        ],
      },
      {
        id: 'p-gaseosa',
        name: 'Gaseosa',
        price: 1900,
        available: true,
        configGroups: [configGroup('g5', 'Tamaño', [{ id: 'op-1l', name: '1L', extraPrice: 600 }])],
      },
    ]

    const orderContext = {
      client: { id: 'client-1' },
      address: { id: 'addr-1', text: 'Calle 1', latitude: -34.6, longitude: -58.4 },
    }

    const withProducts = () =>
      buildMocks({
        productService: {
          ...buildMocks().productService,
          list: jest.fn().mockResolvedValue({ data: stubbedProducts }),
        },
      })

    it('crea los pedidos demo resolubles con snapshot y camino de transiciones', async () => {
      const mocks = withProducts()

      const result = await instantiate(mocks).seed({ order: orderContext })

      expect(mocks.orderService.create).toHaveBeenCalledTimes(2)
      const created = mocks.orderService.create.mock.calls[0][0]
      expect(created).toMatchObject({
        clientId: 'client-1',
        branchId: 'b-Centro',
        addressId: 'addr-1',
      })
      expect(created.items[0]).toMatchObject({ name: 'Hamburguesa Clásica', quantity: 2 })
      expect(created.total).toBeGreaterThan(0)

      expect(result.summary.orders).toBe(2)
      expect(result.orders.map((order) => order.status)).toEqual(['pending', 'ready_for_delivery'])

      const transitions = mocks.orderService.applyTransition.mock.calls.map((call) => call[1])
      expect(transitions).toEqual(['confirmed', 'preparing', 'ready_for_delivery'])
    })

    it('es idempotente: no recrea pedidos si el cliente ya tiene los demo', async () => {
      const mocks = buildMocks({
        orderService: {
          list: jest
            .fn()
            .mockResolvedValue({ data: [], meta: { total: 5, limit: 500, offset: 0 } }),
          create: jest.fn(),
          applyTransition: jest.fn(),
        },
      })

      const result = await instantiate(mocks).seed({ order: orderContext })

      expect(mocks.orderService.create).not.toHaveBeenCalled()
      expect(result.summary.orders).toBe(0)
    })

    it('sin contexto de pedido no crea pedidos', async () => {
      const mocks = buildMocks()

      const result = await instantiate(mocks).seed()

      expect(mocks.orderService.create).not.toHaveBeenCalled()
      expect(result.summary.orders).toBe(0)
    })

    const demoCustomers = [
      {
        id: 'c-1',
        addresses: [
          {
            id: 'a-1',
            text: 'Germán Argerich 1333, Hurlingham',
            latitude: -34.5918429,
            longitude: -58.6371925,
          },
        ],
      },
    ]

    it('genera un lote histórico de pedidos cuando recibe clientes', async () => {
      const mocks = withProducts()

      const result = await instantiate(mocks).seed({
        customers: demoCustomers,
        demo: { orders: 25, days: 30, seed: 42 },
      })

      expect(mocks.demoOrdersRepository.insert).toHaveBeenCalledTimes(1)
      const [planned, batchId] = mocks.demoOrdersRepository.insert.mock.calls[0] as [
        { createdAt: Date; clientId: string; status: string }[],
        string,
      ]

      expect(planned).toHaveLength(25)
      expect(planned.every((order) => order.clientId === 'c-1')).toBe(true)
      expect(planned.every((order) => order.createdAt.getTime() <= Date.now())).toBe(true)
      expect(batchId).toMatch(/^\d{14}-/)
      expect(result.demo).toMatchObject({ enabled: true, orders: 25, customers: 1, seed: 42 })
      expect(result.summary.demoOrders).toBe(25)
    })

    it('es reproducible: la misma semilla genera el mismo lote', async () => {
      const first = withProducts()
      const second = withProducts()

      await instantiate(first).seed({ customers: demoCustomers, demo: { orders: 10, seed: 99 } })
      await instantiate(second).seed({ customers: demoCustomers, demo: { orders: 10, seed: 99 } })

      const firstPlanned = first.demoOrdersRepository.insert.mock.calls[0][0] as {
        status: string
        items: { name: string; quantity: number }[]
      }[]
      const secondPlanned = second.demoOrdersRepository.insert.mock.calls[0][0] as {
        status: string
        items: { name: string; quantity: number }[]
      }[]

      const snapshot = (orders: typeof firstPlanned) =>
        orders.map((order) => ({
          status: order.status,
          items: order.items.map((item) => [item.name, item.quantity]),
        }))

      expect(snapshot(firstPlanned)).toEqual(snapshot(secondPlanned))
    })

    it('resetea los lotes previos cuando se pide reset', async () => {
      const mocks = withProducts()

      const result = await instantiate(mocks).seed({
        customers: demoCustomers,
        demo: { orders: 3, seed: 7, reset: true },
      })

      expect(mocks.demoOrdersRepository.resetDemoData).toHaveBeenCalledTimes(1)
      expect(result.demo.resetDeleted).toBe(0)
    })

    it('sin clientes no genera lote histórico', async () => {
      const mocks = withProducts()

      const result = await instantiate(mocks).seed({ demo: { orders: 10, seed: 1 } })

      expect(mocks.demoOrdersRepository.insert).not.toHaveBeenCalled()
      expect(result.demo.enabled).toBe(false)
      expect(result.summary.demoOrders).toBe(0)
    })
  })
})
