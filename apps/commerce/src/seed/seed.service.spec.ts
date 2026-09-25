import { BranchService } from '../branch/branch.service'
import { CategoryService } from '../category/category.service'
import { IngredientService } from '../ingredient/ingredient.service'
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
})
