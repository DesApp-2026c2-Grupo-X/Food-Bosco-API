import type { BranchService } from '../branch/branch.service'
import type { CategoryService } from '../category/category.service'
import { ERROR_CODES, PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import type { PublicIngredient } from '../ingredient/ingredient.model'
import type { IngredientService } from '../ingredient/ingredient.service'
import type { PublicPromotion } from '../promotion/promotion.model'
import type { PromotionService } from '../promotion/promotion.service'
import type { PublicProduct } from './product.model'
import { ProductOrchestrator } from './product.orchestrator'
import type { ProductService } from './product.service'

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Burger',
  description: 'Rica',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const ingredient = (id: string): PublicIngredient => ({
  id,
  name: `Ingrediente ${id}`,
  unit: 'un',
  minQuantity: 0,
  active: true,
})

const makePromotion = (overrides: Partial<PublicPromotion> = {}): PublicPromotion => ({
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

const makeOrchestrator = () => {
  const productService = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setRecipe: jest.fn(),
    addRecipeItem: jest.fn(),
    updateRecipeItem: jest.fn(),
  }
  const categoryService = { findById: jest.fn() }
  const ingredientService = { findByIds: jest.fn() }
  const promotionService = { getCandidates: jest.fn().mockResolvedValue([]) }
  const branchService = { findAvailable: jest.fn().mockResolvedValue([]) }
  const orchestrator = new ProductOrchestrator(
    productService as unknown as ProductService,
    categoryService as unknown as CategoryService,
    ingredientService as unknown as IngredientService,
    promotionService as unknown as PromotionService,
    branchService as unknown as BranchService,
  )
  return {
    orchestrator,
    productService,
    categoryService,
    ingredientService,
    promotionService,
    branchService,
  }
}

describe('ProductOrchestrator.create — validación de categoría (RQ-CAT-04)', () => {
  it('valida la categoría y delega la creación', async () => {
    const { orchestrator, productService, categoryService } = makeOrchestrator()
    categoryService.findById.mockResolvedValue({ id: 'cat1' })
    productService.create.mockResolvedValue(product())

    const data = { categoryId: 'cat1', name: 'Burger', description: 'Rica', price: 100 }
    await expect(orchestrator.create(data)).resolves.toMatchObject({ id: 'p1' })

    expect(categoryService.findById).toHaveBeenCalledWith('cat1')
    expect(productService.create).toHaveBeenCalledWith(data)
  })

  it('rechaza con CATEGORY_NOT_FOUND 404 y no crea si la categoría no existe', async () => {
    const { orchestrator, productService, categoryService } = makeOrchestrator()
    categoryService.findById.mockResolvedValue(null)

    await expect(
      orchestrator.create({ categoryId: 'missing', name: 'X', description: 'Y', price: 1 }),
    ).rejects.toMatchObject({ code: ERROR_CODES.categoryNotFound, status: 404 })
    expect(productService.create).not.toHaveBeenCalled()
  })
})

describe('ProductOrchestrator.update — validación de categoría (RQ-CAT-04)', () => {
  it('valida la categoría cuando el patch la cambia', async () => {
    const { orchestrator, productService, categoryService } = makeOrchestrator()
    categoryService.findById.mockResolvedValue({ id: 'cat2' })
    productService.update.mockResolvedValue(product({ categoryId: 'cat2' }))

    await expect(orchestrator.update('p1', { categoryId: 'cat2' })).resolves.toBeDefined()
    expect(categoryService.findById).toHaveBeenCalledWith('cat2')
  })

  it('no consulta categorías si el patch no incluye categoryId', async () => {
    const { orchestrator, productService, categoryService } = makeOrchestrator()
    productService.update.mockResolvedValue(product({ price: 150 }))

    await orchestrator.update('p1', { price: 150 })

    expect(categoryService.findById).not.toHaveBeenCalled()
    expect(productService.update).toHaveBeenCalledWith('p1', { price: 150 })
  })

  it('rechaza con CATEGORY_NOT_FOUND 404 si la nueva categoría no existe', async () => {
    const { orchestrator, productService, categoryService } = makeOrchestrator()
    categoryService.findById.mockResolvedValue(null)

    await expect(orchestrator.update('p1', { categoryId: 'missing' })).rejects.toMatchObject({
      code: ERROR_CODES.categoryNotFound,
      status: 404,
    })
    expect(productService.update).not.toHaveBeenCalled()
  })
})

describe('ProductOrchestrator — receta: validación de ingredientes (RQ-CAT-11)', () => {
  const items = [
    { ingredientId: 'ing1', quantity: 2 },
    { ingredientId: 'ing2', quantity: 1 },
  ]

  it('valida los ingredientes únicos y delega setRecipe', async () => {
    const { orchestrator, productService, ingredientService } = makeOrchestrator()
    ingredientService.findByIds.mockResolvedValue([ingredient('ing1'), ingredient('ing2')])
    productService.setRecipe.mockResolvedValue(product())

    await expect(orchestrator.setRecipe('p1', items)).resolves.toBeDefined()

    expect(ingredientService.findByIds).toHaveBeenCalledWith(['ing1', 'ing2'])
    expect(productService.setRecipe).toHaveBeenCalledWith('p1', items)
  })

  it('rechaza con INGREDIENT_NOT_FOUND 404 si falta un ingrediente del setRecipe', async () => {
    const { orchestrator, productService, ingredientService } = makeOrchestrator()
    ingredientService.findByIds.mockResolvedValue([ingredient('ing1')])

    await expect(orchestrator.setRecipe('p1', items)).rejects.toMatchObject({
      code: ERROR_CODES.ingredientNotFound,
      status: 404,
    })
    expect(productService.setRecipe).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'addRecipeItem',
      run: (orchestrator: ProductOrchestrator) =>
        orchestrator.addRecipeItem('p1', { ingredientId: 'ghost', quantity: 1 }),
    },
    {
      name: 'updateRecipeItem',
      run: (orchestrator: ProductOrchestrator) =>
        orchestrator.updateRecipeItem('p1', 'r1', { ingredientId: 'ghost', quantity: 1 }),
    },
  ])('rechaza con INGREDIENT_NOT_FOUND 404 en $name', async ({ run }) => {
    const { orchestrator, productService, ingredientService } = makeOrchestrator()
    ingredientService.findByIds.mockResolvedValue([])

    await expect(run(orchestrator)).rejects.toMatchObject({
      code: ERROR_CODES.ingredientNotFound,
      status: 404,
    })
    expect(productService.addRecipeItem).not.toHaveBeenCalled()
    expect(productService.updateRecipeItem).not.toHaveBeenCalled()
  })

  it('deduplica los ids de ingredientes antes de consultarlos', async () => {
    const { orchestrator, ingredientService, productService } = makeOrchestrator()
    ingredientService.findByIds.mockResolvedValue([ingredient('ing1')])
    productService.setRecipe.mockResolvedValue(product())

    await orchestrator.setRecipe('p1', [
      { ingredientId: 'ing1', quantity: 1 },
      { ingredientId: 'ing1', quantity: 2 },
    ])

    expect(ingredientService.findByIds).toHaveBeenCalledWith(['ing1'])
  })
})

describe('ProductOrchestrator — previews de promociones', () => {
  it('lista productos con preview y resuelve la sucursal desde coordenadas', async () => {
    const { orchestrator, productService, promotionService, branchService } = makeOrchestrator()
    productService.list.mockResolvedValue({
      data: [product()],
      meta: { total: 1, limit: 20, offset: 0 },
    })
    promotionService.getCandidates.mockResolvedValue([makePromotion()])
    branchService.findAvailable.mockResolvedValue([{ id: 'branch-1' }])

    const result = await orchestrator.listWithPreviews(
      { limit: 20, offset: 0 },
      { lat: -34.6, lng: -58.4 },
    )

    expect(branchService.findAvailable).toHaveBeenCalledWith(-34.6, -58.4)
    expect(promotionService.getCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-1' }),
    )
    expect(result.data[0].promotion?.badge).toBe('-20%')
    expect(result.data[0].promotion?.estimatedUnitPrice).toBe(80)
  })

  it('sin coordenadas sólo evalúa promociones globales', async () => {
    const { orchestrator, productService, promotionService, branchService } = makeOrchestrator()
    productService.list.mockResolvedValue({
      data: [product()],
      meta: { total: 1, limit: 20, offset: 0 },
    })

    await orchestrator.listWithPreviews({ limit: 20, offset: 0 })

    expect(branchService.findAvailable).not.toHaveBeenCalled()
    expect(promotionService.getCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null }),
    )
  })

  it('rechaza coordenadas incompletas', async () => {
    const { orchestrator, productService } = makeOrchestrator()
    productService.list.mockResolvedValue({
      data: [],
      meta: { total: 0, limit: 20, offset: 0 },
    })

    await expect(
      orchestrator.listWithPreviews({ limit: 20, offset: 0 }, { lat: -34.6 }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.validationError,
      status: 400,
    })
  })

  it('devuelve null si el producto no existe', async () => {
    const { orchestrator, productService } = makeOrchestrator()
    productService.findById.mockResolvedValue(null)

    await expect(orchestrator.findByIdWithPreviews('missing')).resolves.toBeNull()
  })
})
