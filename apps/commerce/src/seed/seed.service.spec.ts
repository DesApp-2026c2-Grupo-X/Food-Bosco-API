import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { IngredientService } from '../ingredient/ingredient.service'
import { OrderService } from '../order/order.service'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import { StockService } from '../stock/stock.service'
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
  },
  branchService: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    upsertByName: jest.fn().mockImplementation(async (seed: { name: string }) => ({
      id: `b-${seed.name}`,
      name: seed.name,
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
        upsertByName: jest.fn(),
        updateHours: jest.fn(),
      },
    })
    const service = instantiate(mocks)

    const result = await service.seed()

    expect(mocks.branchService.upsertByName).not.toHaveBeenCalled()
    expect(mocks.branchService.updateHours).not.toHaveBeenCalled()
    expect(result.branches).toHaveLength(3)
  })

  it('es idempotente: no vuelve a crear catálogo que ya existe', async () => {
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
        list: jest.fn().mockResolvedValue({ data: [] }),
        upsertByName: jest.fn().mockImplementation(async (seed: { name: string }) => ({
          id: `i-${seed.name}`,
          name: seed.name,
        })),
      },
    })
    const service = instantiate(mocks)

    const result = await service.seed()

    expect(mocks.categoryService.upsertByName).not.toHaveBeenCalled()
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
  })
})
