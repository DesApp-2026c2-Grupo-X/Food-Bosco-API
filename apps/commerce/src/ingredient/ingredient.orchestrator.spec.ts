import { ERROR_CODES } from '../config/constants'
import type { ProductService } from '../product/product.service'
import type { PublicIngredient } from './ingredient.model'
import { IngredientOrchestrator } from './ingredient.orchestrator'
import type { IngredientService } from './ingredient.service'

const ingredient = (active: boolean): PublicIngredient => ({
  id: 'ing1',
  name: 'Papa',
  unit: 'kg',
  active,
})

const makeOrchestrator = () => {
  const ingredientService = { setActive: jest.fn() }
  const productService = { isIngredientInUse: jest.fn() }
  const orchestrator = new IngredientOrchestrator(
    ingredientService as unknown as IngredientService,
    productService as unknown as ProductService,
  )
  return { orchestrator, ingredientService, productService }
}

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
