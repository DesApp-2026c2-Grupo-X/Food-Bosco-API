import { CONFIG_GROUP_TYPE, ERROR_CODES, ROLES } from '../config/constants'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicConfigGroup, PublicConfigOption, PublicProduct } from './product.model'
import { ProductController } from './product.controller'
import type { ProductListResponse } from './product.service'
import { ProductService } from './product.service'

const auth = (roles: AuthContext['roles']): AuthContext => ({
  authenticated: roles.length > 0,
  userId: 'u1',
  roles,
  branchId: null,
  internal: false,
})

const buildOption = (overrides: Partial<PublicConfigOption> = {}): PublicConfigOption => ({
  id: 'opt1',
  name: 'Queso',
  extraPrice: 10,
  available: true,
  ...overrides,
})

const buildGroup = (overrides: Partial<PublicConfigGroup> = {}): PublicConfigGroup => ({
  id: 'g1',
  name: 'Adicionales',
  type: CONFIG_GROUP_TYPE.multiple,
  required: false,
  min: 0,
  max: 2,
  options: [buildOption()],
  ...overrides,
})

const buildProduct = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'cat1',
  name: 'Burger',
  description: 'Rica',
  price: 100,
  image: null,
  available: true,
  configGroups: [buildGroup()],
  recipe: [
    {
      id: 'r1',
      ingredientId: 'ing1',
      quantity: 2,
      optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
    },
  ],
  ...overrides,
})

const emptyList: ProductListResponse = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

const makeController = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const service = {
    list: jest.fn().mockResolvedValue(emptyList),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setAvailable: jest.fn(),
    addConfigGroup: jest.fn(),
    updateConfigGroup: jest.fn(),
    removeConfigGroup: jest.fn(),
    addConfigOption: jest.fn(),
    updateConfigOption: jest.fn(),
    removeConfigOption: jest.fn(),
    setRecipe: jest.fn(),
    addRecipeItem: jest.fn(),
    updateRecipeItem: jest.fn(),
    removeRecipeItem: jest.fn(),
    ...overrides,
  }
  return { service, controller: new ProductController(service as unknown as ProductService) }
}

describe('ProductController.list — visibilidad por rol (RQ-CAT-05)', () => {
  it.each([
    { name: 'público anónimo sólo ve disponibles', roles: [] as AuthContext['roles'], expected: true },
    { name: 'branch_admin no es admin global, sólo ve disponibles', roles: [ROLES.branchAdmin] as AuthContext['roles'], expected: true },
    { name: 'super_admin ve todos por defecto', roles: [ROLES.superAdmin] as AuthContext['roles'], expected: undefined },
  ])('$name', async ({ roles, expected }) => {
    const { service, controller } = makeController()

    await controller.list(auth(roles), {})

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ available: expected }))
  })

  it('respeta available explícito aunque sea super_admin', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), { available: false })

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ available: false }))
  })

  it('aplica paginación por defecto limit 20 / offset 0', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), {})

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }))
  })

  it('propaga los filtros explícitos', async () => {
    const { service, controller } = makeController()

    await controller.list(auth([ROLES.superAdmin]), { categoryId: 'cat1', search: 'bur', limit: 5, offset: 10 })

    expect(service.list).toHaveBeenCalledWith({
      categoryId: 'cat1',
      search: 'bur',
      available: undefined,
      limit: 5,
      offset: 10,
    })
  })
})

describe('ProductController.create (RQ-CAT-03)', () => {
  it('delega en el servicio con el DTO recibido', async () => {
    const { service, controller } = makeController({
      create: jest.fn().mockResolvedValue(buildProduct()),
    })

    const dto = { categoryId: 'cat1', name: 'Burger', description: 'Rica', price: 100 }
    await expect(controller.create(dto)).resolves.toMatchObject({ id: 'p1' })
    expect(service.create).toHaveBeenCalledWith(dto)
  })
})

describe('ProductController.get / update / setAvailable — PRODUCT_NOT_FOUND', () => {
  it('devuelve el producto cuando existe', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(buildProduct()) })

    await expect(controller.get('p1')).resolves.toMatchObject({ id: 'p1' })
  })

  it.each([
    {
      name: 'get',
      run: (controller: ProductController) => controller.get('missing'),
      overrides: { findById: jest.fn().mockResolvedValue(null) },
    },
    {
      name: 'update',
      run: (controller: ProductController) => controller.update('missing', { price: 1 }),
      overrides: { findById: jest.fn().mockResolvedValue(buildProduct()), update: jest.fn().mockResolvedValue(null) },
    },
    {
      name: 'setAvailable',
      run: (controller: ProductController) => controller.setAvailable('missing', { available: false }),
      overrides: { findById: jest.fn().mockResolvedValue(buildProduct()), setAvailable: jest.fn().mockResolvedValue(null) },
    },
  ] as Array<{ name: string; run: (controller: ProductController) => Promise<unknown>; overrides: Partial<Record<string, jest.Mock>> }>)(
    'lanza PRODUCT_NOT_FOUND 404 en $name',
    async ({ run, overrides }) => {
      const { controller } = makeController(overrides)

      await expect(run(controller)).rejects.toMatchObject({
        code: ERROR_CODES.productNotFound,
        message: 'Producto no encontrado',
        status: 404,
      })
    },
  )
})

describe('ProductController — configuraciones (RQ-CAT-06/07)', () => {
  it('lista las configuraciones del producto existente', async () => {
    const group = buildGroup()
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(buildProduct({ configGroups: [group] })) })

    await expect(controller.listConfigurations('p1')).resolves.toEqual([group])
  })

  it('lanza PRODUCT_NOT_FOUND si el producto no existe en listConfigurations', async () => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

    await expect(controller.listConfigurations('missing')).rejects.toMatchObject({
      code: ERROR_CODES.productNotFound,
      status: 404,
    })
  })

  it('crea el grupo y lo devuelve', async () => {
    const group = buildGroup()
    const dto = { name: 'Adicionales', type: CONFIG_GROUP_TYPE.multiple, required: false }
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      addConfigGroup: jest.fn().mockResolvedValue(group),
    })

    await expect(controller.createConfigGroup('p1', dto)).resolves.toBe(group)
    expect(service.addConfigGroup).toHaveBeenCalledWith('p1', dto)
  })

  it('lanza PRODUCT_NOT_FOUND si addConfigGroup devuelve null', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      addConfigGroup: jest.fn().mockResolvedValue(null),
    })

    await expect(
      controller.createConfigGroup('p1', { name: 'X', type: CONFIG_GROUP_TYPE.single, required: true }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.productNotFound,
      message: 'Producto no encontrado',
      status: 404,
    })
  })

  it.each([
    {
      name: 'updateConfigGroup',
      run: (controller: ProductController) => controller.updateConfigGroup('p1', 'missing', { name: 'X' }),
      overrides: { updateConfigGroup: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.configGroupNotFound,
      message: 'Grupo no encontrado',
    },
    {
      name: 'removeConfigGroup',
      run: (controller: ProductController) => controller.removeConfigGroup('p1', 'missing'),
      overrides: { removeConfigGroup: jest.fn().mockResolvedValue(false) },
      code: ERROR_CODES.configGroupNotFound,
      message: 'Grupo no encontrado',
    },
    {
      name: 'createConfigOption',
      run: (controller: ProductController) => controller.createConfigOption('p1', 'missing', { name: 'X', extraPrice: 1 }),
      overrides: { addConfigOption: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.configGroupNotFound,
      message: 'Grupo no encontrado',
    },
  ] as Array<{
    name: string
    run: (controller: ProductController) => Promise<unknown>
    overrides: Partial<Record<string, jest.Mock>>
    code: string
    message: string
  }>)('lanza $code 404 en $name', async ({ run, overrides, code, message }) => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(buildProduct()), ...overrides })

    await expect(run(controller)).rejects.toMatchObject({ code, message, status: 404 })
  })

  it('actualiza el grupo y lo devuelve', async () => {
    const group = buildGroup({ name: 'Nuevo' })
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      updateConfigGroup: jest.fn().mockResolvedValue(group),
    })

    await expect(controller.updateConfigGroup('p1', 'g1', { name: 'Nuevo' })).resolves.toBe(group)
    expect(service.updateConfigGroup).toHaveBeenCalledWith('p1', 'g1', { name: 'Nuevo' })
  })

  it('elimina el grupo y devuelve { ok: true }', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      removeConfigGroup: jest.fn().mockResolvedValue(true),
    })

    await expect(controller.removeConfigGroup('p1', 'g1')).resolves.toEqual({ ok: true })
  })
})

describe('ProductController — opciones (RQ-CAT-08)', () => {
  it('agrega la opción y la devuelve', async () => {
    const option = buildOption()
    const dto = { name: 'Queso', extraPrice: 10 }
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      addConfigOption: jest.fn().mockResolvedValue(option),
    })

    await expect(controller.createConfigOption('p1', 'g1', dto)).resolves.toBe(option)
    expect(service.addConfigOption).toHaveBeenCalledWith('p1', 'g1', dto)
  })

  it('actualiza la opción y la devuelve', async () => {
    const option = buildOption({ available: false })
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      updateConfigOption: jest.fn().mockResolvedValue(option),
    })

    await expect(controller.updateConfigOption('p1', 'g1', 'opt1', { available: false })).resolves.toBe(option)
    expect(service.updateConfigOption).toHaveBeenCalledWith('p1', 'g1', 'opt1', { available: false })
  })

  it.each([
    {
      name: 'updateConfigOption',
      run: (controller: ProductController) => controller.updateConfigOption('p1', 'g1', 'missing', { name: 'X' }),
      overrides: { updateConfigOption: jest.fn().mockResolvedValue(null) },
    },
    {
      name: 'removeConfigOption',
      run: (controller: ProductController) => controller.removeConfigOption('p1', 'g1', 'missing'),
      overrides: { removeConfigOption: jest.fn().mockResolvedValue(false) },
    },
  ] as Array<{ name: string; run: (controller: ProductController) => Promise<unknown>; overrides: Partial<Record<string, jest.Mock>> }>)(
    'lanza CONFIG_OPTION_NOT_FOUND 404 en $name',
    async ({ run, overrides }) => {
      const { controller } = makeController({ findById: jest.fn().mockResolvedValue(buildProduct()), ...overrides })

      await expect(run(controller)).rejects.toMatchObject({
        code: ERROR_CODES.configOptionNotFound,
        message: 'Opción no encontrada',
        status: 404,
      })
    },
  )

  it('elimina la opción y devuelve { ok: true }', async () => {
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(buildProduct()),
      removeConfigOption: jest.fn().mockResolvedValue(true),
    })

    await expect(controller.removeConfigOption('p1', 'g1', 'opt1')).resolves.toEqual({ ok: true })
  })
})

describe('ProductController — receta (RQ-CAT-11/12)', () => {
  it('devuelve la receta del producto existente', async () => {
    const product = buildProduct()
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(product) })

    await expect(controller.getRecipe('p1')).resolves.toEqual(product.recipe)
  })

  it('reemplaza la receta y devuelve el producto', async () => {
    const product = buildProduct()
    const dto = { items: [{ ingredientId: 'ing1', quantity: 2 }] }
    const { service, controller } = makeController({
      findById: jest.fn().mockResolvedValue(product),
      setRecipe: jest.fn().mockResolvedValue(product),
    })

    await expect(controller.setRecipe('p1', dto)).resolves.toBe(product)
    expect(service.setRecipe).toHaveBeenCalledWith('p1', dto.items)
  })

  it.each([
    {
      name: 'setRecipe',
      run: (controller: ProductController) => controller.setRecipe('p1', { items: [] }),
      overrides: { setRecipe: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.productNotFound,
      message: 'Producto no encontrado',
    },
    {
      name: 'addRecipeItem',
      run: (controller: ProductController) => controller.addRecipeItem('p1', { ingredientId: 'ing1', quantity: 1 }),
      overrides: { addRecipeItem: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.productNotFound,
      message: 'Producto no encontrado',
    },
    {
      name: 'updateRecipeItem',
      run: (controller: ProductController) => controller.updateRecipeItem('p1', 'missing', { ingredientId: 'ing1', quantity: 1 }),
      overrides: { updateRecipeItem: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.recipeItemNotFound,
      message: 'Ítem de receta no encontrado',
    },
    {
      name: 'removeRecipeItem',
      run: (controller: ProductController) => controller.removeRecipeItem('p1', 'missing'),
      overrides: { removeRecipeItem: jest.fn().mockResolvedValue(null) },
      code: ERROR_CODES.recipeItemNotFound,
      message: 'Ítem de receta no encontrado',
    },
  ] as Array<{
    name: string
    run: (controller: ProductController) => Promise<unknown>
    overrides: Partial<Record<string, jest.Mock>>
    code: string
    message: string
  }>)('lanza $code 404 en $name', async ({ run, overrides, code, message }) => {
    const { controller } = makeController({ findById: jest.fn().mockResolvedValue(buildProduct()), ...overrides })

    await expect(run(controller)).rejects.toMatchObject({ code, message, status: 404 })
  })

  // KNOWN BUG: el repositorio nunca devuelve null al quitar un ítem inexistente (siempre
  // guarda y devuelve el producto), así que este controller jamás lanza RECIPE_ITEM_NOT_FOUND
  // en ese caso: un DELETE de un ítem inexistente responde 200.
  it('KNOWN BUG: removeRecipeItem de un ítem inexistente devuelve el producto sin lanzar 404', async () => {
    const product = buildProduct()
    const { controller } = makeController({
      findById: jest.fn().mockResolvedValue(product),
      removeRecipeItem: jest.fn().mockResolvedValue(product),
    })

    await expect(controller.removeRecipeItem('p1', 'missing')).resolves.toBe(product)
  })
})

describe('ProductController — requireProduct en subrutas', () => {
  it.each([
    { name: 'configuraciones', run: (controller: ProductController) => controller.listConfigurations('missing') },
    { name: 'receta', run: (controller: ProductController) => controller.getRecipe('missing') },
    {
      name: 'setReceta',
      run: (controller: ProductController) => controller.setRecipe('missing', { items: [] }),
    },
  ] as Array<{ name: string; run: (controller: ProductController) => Promise<unknown> }>)(
    'lanza PRODUCT_NOT_FOUND 404 cuando el producto no existe ($name)',
    async ({ run }) => {
      const { controller } = makeController({ findById: jest.fn().mockResolvedValue(null) })

      await expect(run(controller)).rejects.toMatchObject({ code: ERROR_CODES.productNotFound, status: 404 })
    },
  )
})
