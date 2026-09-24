import { ERROR_CODES } from '../config/constants'
import { IngredientController } from './ingredient.controller'
import type { IngredientListResponse } from './ingredient.service'
import { IngredientService } from './ingredient.service'

const emptyList: IngredientListResponse = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

const makeController = (
  overrides: Partial<
    Record<'list' | 'findById' | 'create' | 'update' | 'setActive', jest.Mock>
  > = {},
) => {
  const service = {
    list: jest.fn().mockResolvedValue(emptyList),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    ...overrides,
  }
  return { service, controller: new IngredientController(service as unknown as IngredientService) }
}

describe('IngredientController.list (RQ-CAT-09)', () => {
  it('aplica paginación por defecto limit 20 / offset 0', async () => {
    const { service, controller } = makeController()

    await controller.list({})

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0, activeOnly: undefined, search: undefined }),
    )
  })

  it('propaga activeOnly, search, limit y offset explícitos', async () => {
    const { service, controller } = makeController()

    await controller.list({ activeOnly: true, search: 'pa', limit: 5, offset: 2 })

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true, search: 'pa', limit: 5, offset: 2 }),
    )
  })
})

describe('IngredientController.create (RQ-CAT-09)', () => {
  it('delega en el servicio con el DTO recibido', async () => {
    const { service, controller } = makeController({
      create: jest.fn().mockResolvedValue({ id: 'ing1', name: 'Queso', unit: 'kg', active: true }),
    })

    await expect(controller.create({ name: 'Queso', unit: 'kg' })).resolves.toMatchObject({
      id: 'ing1',
    })
    expect(service.create).toHaveBeenCalledWith({ name: 'Queso', unit: 'kg' })
  })
})

describe('IngredientController.get — error de dominio', () => {
  it('devuelve el ingrediente cuando existe', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue({ id: 'ing1', name: 'Papa', unit: 'kg', active: true }),
    })

    await expect(controller.get('ing1')).resolves.toMatchObject({ id: 'ing1' })
  })

  it('lanza INGREDIENT_NOT_FOUND 404 con mensaje cuando no existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.get('missing')).rejects.toMatchObject({
      code: ERROR_CODES.ingredientNotFound,
      message: 'Ingrediente no encontrado',
      status: 404,
    })
  })
})

describe('IngredientController.update / setActive — error de dominio', () => {
  it('lanza INGREDIENT_NOT_FOUND 404 al actualizar un id inexistente', async () => {
    const { controller } = makeController({ update: jest.fn().mockResolvedValue(null) })

    await expect(controller.update('missing', { unit: 'g' })).rejects.toMatchObject({
      code: ERROR_CODES.ingredientNotFound,
      message: 'Ingrediente no encontrado',
      status: 404,
    })
  })

  it('lanza INGREDIENT_NOT_FOUND 404 al activar/desactivar un id inexistente', async () => {
    const { controller } = makeController({ setActive: jest.fn().mockResolvedValue(null) })

    await expect(controller.setActive('missing', { active: false })).rejects.toMatchObject({
      code: ERROR_CODES.ingredientNotFound,
      message: 'Ingrediente no encontrado',
      status: 404,
    })
  })

  it('pasa el nuevo estado al servicio al activar/desactivar', async () => {
    const { service, controller } = makeController({
      setActive: jest
        .fn()
        .mockResolvedValue({ id: 'ing1', name: 'Papa', unit: 'kg', active: false }),
    })

    await controller.setActive('ing1', { active: false })

    expect(service.setActive).toHaveBeenCalledWith('ing1', false)
  })
})
