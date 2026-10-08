import type { CategoryService } from '../category/category.service'
import { ERROR_CODES } from '../config/constants'
import type { PublicIngredient } from '../ingredient/ingredient.model'
import type { IngredientService } from '../ingredient/ingredient.service'
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
  active: true,
})

const makeOrchestrator = () => {
  const productService = {
    create: jest.fn(),
    update: jest.fn(),
    setRecipe: jest.fn(),
    addRecipeItem: jest.fn(),
    updateRecipeItem: jest.fn(),
  }
  const categoryService = { findById: jest.fn() }
  const ingredientService = { findByIds: jest.fn() }
  const orchestrator = new ProductOrchestrator(
    productService as unknown as ProductService,
    categoryService as unknown as CategoryService,
    ingredientService as unknown as IngredientService,
  )
  return { orchestrator, productService, categoryService, ingredientService }
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
