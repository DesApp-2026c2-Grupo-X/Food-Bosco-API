import { ERROR_CODES, PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import type { DomainException } from '../config/exceptions/domain.exception'
import type { IngredientService } from '../ingredient/ingredient.service'
import type { PublicProduct } from '../product/product.model'
import type { PublicPromotion } from '../promotion/promotion.model'
import type { ProductService } from '../product/product.service'
import type { PromotionService } from '../promotion/promotion.service'
import type { StockService } from '../stock/stock.service'
import { BranchOrchestrator } from './branch.orchestrator'
import type { PublicBranch } from './branch.model'
import type { BranchService } from './branch.service'

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const promotion = (overrides: Partial<PublicPromotion> = {}): PublicPromotion => ({
  id: 'promo-1',
  name: '20% en burgers',
  description: null,
  startDate: '2020-01-01T00:00:00.000Z',
  endDate: '2099-12-31T23:59:59.999Z',
  active: true,
  type: PROMOTION_TYPE.percentage,
  discountValue: 20,
  maxDiscount: null,
  buyQuantity: null,
  payQuantity: null,
  scope: PROMOTION_SCOPE.product,
  categoryIds: [],
  productIds: ['p1'],
  branchIds: [],
  minSubtotal: 0,
  minQuantity: 0,
  daysOfWeek: [],
  startTime: null,
  endTime: null,
  code: null,
  stackable: false,
  priority: 0,
  maxUsesTotal: null,
  maxUsesPerCustomer: null,
  usedCount: 0,
  ...overrides,
})

const branch = (id: string): PublicBranch => ({
  id,
  name: `Sucursal ${id}`,
  addressText: 'Av 1',
  latitude: 0,
  longitude: 0,
  phone: null,
  active: true,
  hours: [],
})

const makeOrchestrator = () => {
  const branchService = {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(branch('b1')),
    getAvailabilityMap: jest.fn(),
    findAvailable: jest.fn(),
    setProductAvailability: jest.fn(),
  }
  const productService = { findAll: jest.fn(), findById: jest.fn() }
  const ingredientService = { list: jest.fn().mockResolvedValue({ data: [] }) }
  const stockService = { ensureStockRows: jest.fn().mockResolvedValue(undefined) }
  const promotionService = { getCandidates: jest.fn().mockResolvedValue([]) }
  const orchestrator = new BranchOrchestrator(
    branchService as unknown as BranchService,
    productService as unknown as ProductService,
    ingredientService as unknown as IngredientService,
    stockService as unknown as StockService,
    promotionService as unknown as PromotionService,
  )
  return {
    orchestrator,
    branchService,
    productService,
    ingredientService,
    stockService,
    promotionService,
  }
}

const captureError = async (promise: Promise<unknown>): Promise<DomainException> => {
  const error = await promise.then(
    () => {
      throw new Error('Se esperaba un DomainException')
    },
    (rejection: unknown) => rejection,
  )
  if (!(error instanceof Error) || !('code' in error)) {
    throw new Error('Se esperaba un DomainException')
  }
  return error as unknown as DomainException
}

describe('BranchOrchestrator.create', () => {
  it('crea la sucursal e inicializa stock en 0 para los ingredientes existentes', async () => {
    const { orchestrator, branchService, ingredientService, stockService } = makeOrchestrator()
    const created = branch('b-new')
    branchService.create.mockResolvedValue(created)
    ingredientService.list.mockResolvedValue({ data: [{ id: 'i1' }, { id: 'i2' }] })
    const dto = { name: 'Nueva', addressText: 'Calle 1', latitude: -34.6, longitude: -58.4 }

    const result = await orchestrator.create(dto)

    expect(branchService.create).toHaveBeenCalledWith(dto)
    expect(ingredientService.list).toHaveBeenCalledWith({ limit: 500, offset: 0 })
    expect(stockService.ensureStockRows).toHaveBeenCalledWith(['b-new'], ['i1', 'i2'])
    expect(result).toEqual(created)
  })
})

describe('BranchOrchestrator.listProducts (RQ-CAT-16)', () => {
  it.each([
    { name: 'sin registro → disponible por defecto', map: new Map(), expected: true },
    { name: 'marcado disponible', map: new Map([['p1', true]]), expected: true },
    { name: 'pausado en la sucursal', map: new Map([['p1', false]]), expected: false },
  ])('$name', async ({ map, expected }) => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.getAvailabilityMap.mockResolvedValue(map)
    productService.findAll.mockResolvedValue([product()])

    const result = await orchestrator.listProducts('b1')

    expect(branchService.getAvailabilityMap).toHaveBeenCalledWith('b1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: 'p1',
      name: 'Hamburguesa',
      availableInBranch: expected,
    })
  })

  it('combina el flag de disponibilidad producto por producto', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.getAvailabilityMap.mockResolvedValue(new Map([['p2', false]]))
    productService.findAll.mockResolvedValue([product(), product({ id: 'p2', name: 'Papas' })])

    const result = await orchestrator.listProducts('b1')

    expect(result.data.map((item) => [item.id, item.availableInBranch])).toEqual([
      ['p1', true],
      ['p2', false],
    ])
  })

  it('adjunta el preview de promociones vigentes de la sucursal', async () => {
    const { orchestrator, branchService, productService, promotionService } = makeOrchestrator()
    branchService.getAvailabilityMap.mockResolvedValue(new Map())
    productService.findAll.mockResolvedValue([product()])
    promotionService.getCandidates.mockResolvedValue([promotion()])

    const result = await orchestrator.listProducts('b1')

    expect(promotionService.getCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1' }),
    )
    expect(result.data[0].promotion?.badge).toBe('-20%')
    expect(result.data[0].promotion?.estimatedUnitPrice).toBe(80)
  })
})

describe('BranchOrchestrator.listZoneProducts (RQ-BRN-08)', () => {
  it('usa la sucursal más cercana (primera) para combinar productos', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findAvailable.mockResolvedValue([branch('near'), branch('far')])
    branchService.getAvailabilityMap.mockResolvedValue(new Map())
    productService.findAll.mockResolvedValue([product()])

    const result = await orchestrator.listZoneProducts(-34.6, -58.4)

    expect(branchService.findAvailable).toHaveBeenCalledWith(-34.6, -58.4)
    expect(branchService.getAvailabilityMap).toHaveBeenCalledWith('near')
    expect(result.data).toHaveLength(1)
  })

  it('sin sucursal disponible → [] sin consultar productos', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findAvailable.mockResolvedValue([])

    const result = await orchestrator.listZoneProducts(0, 0)

    expect(result).toEqual({ data: [] })
    expect(productService.findAll).not.toHaveBeenCalled()
    expect(branchService.getAvailabilityMap).not.toHaveBeenCalled()
  })
})

describe('BranchOrchestrator — sucursal inexistente (INT-09)', () => {
  it('listProducts con sucursal inexistente → BRANCH_NOT_FOUND (404) sin consultar productos', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findById.mockResolvedValue(null)

    const error = await captureError(orchestrator.listProducts('missing'))

    expect(error).toMatchObject({
      code: ERROR_CODES.branchNotFound,
      message: 'Sucursal no encontrada',
    })
    expect(error.getStatus()).toBe(404)
    expect(productService.findAll).not.toHaveBeenCalled()
    expect(branchService.getAvailabilityMap).not.toHaveBeenCalled()
  })
})

describe('BranchOrchestrator.setProductAvailability (INT-09)', () => {
  it('sucursal inexistente → BRANCH_NOT_FOUND (404) sin tocar disponibilidad', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    branchService.findById.mockResolvedValue(null)

    const error = await captureError(orchestrator.setProductAvailability('missing', 'p1', false))

    expect(error).toMatchObject({ code: ERROR_CODES.branchNotFound })
    expect(error.getStatus()).toBe(404)
    expect(productService.findById).not.toHaveBeenCalled()
    expect(branchService.setProductAvailability).not.toHaveBeenCalled()
  })

  it('producto inexistente → PRODUCT_NOT_FOUND (404) sin tocar disponibilidad', async () => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    productService.findById.mockResolvedValue(null)

    const error = await captureError(orchestrator.setProductAvailability('b1', 'missing', true))

    expect(error).toMatchObject({
      code: ERROR_CODES.productNotFound,
      message: 'Producto no encontrado',
    })
    expect(error.getStatus()).toBe(404)
    expect(branchService.setProductAvailability).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'pausar', available: false },
    { name: 'reactivar', available: true },
  ])('$name un producto existente delega en el servicio', async ({ available }) => {
    const { orchestrator, branchService, productService } = makeOrchestrator()
    productService.findById.mockResolvedValue(product())
    branchService.setProductAvailability.mockResolvedValue(undefined)

    await expect(
      orchestrator.setProductAvailability('b1', 'p1', available),
    ).resolves.toBeUndefined()
    expect(branchService.setProductAvailability).toHaveBeenCalledWith('b1', 'p1', available)
  })
})
