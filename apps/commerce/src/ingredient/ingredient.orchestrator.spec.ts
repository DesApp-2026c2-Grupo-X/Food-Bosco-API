import type { BranchService } from '../branch/branch.service'
import { ERROR_CODES } from '../config/constants'
import type { ProductService } from '../product/product.service'
import type { StockService } from '../stock/stock.service'
import type { PublicIngredient } from './ingredient.model'
import { IngredientOrchestrator } from './ingredient.orchestrator'
import type { IngredientService } from './ingredient.service'

const ingredient = (active: boolean, minQuantity = 0): PublicIngredient => ({
  id: 'ing1',
  name: 'Papa',
  unit: 'kg',
  minQuantity,
  active,
})

const makeOrchestrator = () => {
  const ingredientService = { create: jest.fn(), setActive: jest.fn() }
  const productService = { isIngredientInUse: jest.fn() }
  const branchService = { list: jest.fn().mockResolvedValue({ data: [] }) }
  const stockService = { ensureStockRows: jest.fn().mockResolvedValue(undefined) }
  const orchestrator = new IngredientOrchestrator(
    ingredientService as unknown as IngredientService,
    productService as unknown as ProductService,
    branchService as unknown as BranchService,
    stockService as unknown as StockService,
  )
  return { orchestrator, ingredientService, productService, branchService, stockService }
}

describe('IngredientOrchestrator.create', () => {
  it('crea el ingrediente e inicializa filas de stock en todas las sucursales existentes', async () => {
    const { orchestrator, ingredientService, branchService, stockService } = makeOrchestrator()
    const created = ingredient(true, 10)
    ingredientService.create.mockResolvedValue(created)
    branchService.list.mockResolvedValue({ data: [{ id: 'b1' }, { id: 'b2' }] })

    const result = await orchestrator.create({ name: 'Papa', unit: 'kg', minQuantity: 10 })

    expect(ingredientService.create).toHaveBeenCalledWith({
      name: 'Papa',
      unit: 'kg',
      minQuantity: 10,
    })
    expect(branchService.list).toHaveBeenCalledWith({ limit: 500, offset: 0 })
    expect(stockService.ensureStockRows).toHaveBeenCalledWith(['b1', 'b2'], ['ing1'])
    expect(result).toEqual(created)
  })

  it('no llama a ensureStockRows cuando no hay sucursales creadas', async () => {
    const { orchestrator, ingredientService, branchService, stockService } = makeOrchestrator()
    ingredientService.create.mockResolvedValue(ingredient(true, 5))
    branchService.list.mockResolvedValue({ data: [] })

    await orchestrator.create({ name: 'Papa', unit: 'kg', minQuantity: 5 })

    expect(stockService.ensureStockRows).not.toHaveBeenCalled()
  })
})

describe('IngredientOrchestrator.setActive — RQ-CAT-10 / INGREDIENT_IN_USE', () => {
  it('rechaza con INGREDIENT_IN_USE 409 al desactivar un ingrediente en uso', async () => {
    const { orchestrator, ingredientService, productService } = makeOrchestrator()
    productService.isIngredientInUse.mockResolvedValue(true)

    await expect(orchestrator.setActive('ing1', false)).rejects.toMatchObject({
      code: ERROR_CODES.ingredientInUse,
      status: 409,
    })
    expect(ingredientService.setActive).not.toHaveBeenCalled()
  })

  it('desactiva un ingrediente que no está en uso', async () => {
    const { orchestrator, ingredientService, productService } = makeOrchestrator()
    productService.isIngredientInUse.mockResolvedValue(false)
    ingredientService.setActive.mockResolvedValue(ingredient(false))

    const result = await orchestrator.setActive('ing1', false)

    expect(productService.isIngredientInUse).toHaveBeenCalledWith('ing1')
    expect(ingredientService.setActive).toHaveBeenCalledWith('ing1', false)
    expect(result?.active).toBe(false)
  })

  it('activa sin consultar el uso en recetas', async () => {
    const { orchestrator, ingredientService, productService } = makeOrchestrator()
    ingredientService.setActive.mockResolvedValue(ingredient(true))

    const result = await orchestrator.setActive('ing1', true)

    expect(productService.isIngredientInUse).not.toHaveBeenCalled()
    expect(ingredientService.setActive).toHaveBeenCalledWith('ing1', true)
    expect(result?.active).toBe(true)
  })

  it('propaga null si el ingrediente no existe al desactivar', async () => {
    const { orchestrator, ingredientService, productService } = makeOrchestrator()
    productService.isIngredientInUse.mockResolvedValue(false)
    ingredientService.setActive.mockResolvedValue(null)

    await expect(orchestrator.setActive('missing', false)).resolves.toBeNull()
  })
})
