import type { Types } from 'mongoose'
import { CONFIG_GROUP_TYPE, ERROR_CODES } from '../config/constants'
import { OPTION_NOT_FOUND } from './product.model'
import type { ConfigGroup, ConfigOption, ProductDocument, RecipeItem } from './product.model'
import type { ProductListQuery, RecipeItemData } from './product.repository'
import { ProductRepository } from './product.repository'
import { ProductService } from './product.service'

const objectId = (value: string): Types.ObjectId =>
  ({ toString: () => value }) as unknown as Types.ObjectId

const buildOption = (overrides: Partial<Record<string, unknown>> = {}): ConfigOption =>
  ({
    _id: objectId('opt1'),
    name: 'Queso',
    extraPrice: 10,
    available: true,
    ...overrides,
  }) as unknown as ConfigOption

const buildGroup = (overrides: Partial<Record<string, unknown>> = {}): ConfigGroup =>
  ({
    _id: objectId('g1'),
    name: 'Adicionales',
    type: CONFIG_GROUP_TYPE.multiple,
    required: false,
    min: 0,
    max: 2,
    options: [buildOption()],
    ...overrides,
  }) as unknown as ConfigGroup

const buildRecipeItem = (overrides: Partial<Record<string, unknown>> = {}): RecipeItem =>
  ({
    _id: objectId('r1'),
    ingredientId: 'ing1',
    quantity: 2,
    optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
    ...overrides,
  }) as unknown as RecipeItem

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): ProductDocument =>
  ({
    _id: objectId('p1'),
    categoryId: 'cat1',
    name: 'Burger',
    description: 'Rica',
    price: 100,
    image: null,
    available: true,
    configGroups: [buildGroup()],
    recipe: [buildRecipeItem()],
    ...overrides,
  }) as unknown as ProductDocument

const makeService = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const repository = {
    list: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setAvailable: jest.fn(),
    addConfigGroup: jest.fn(),
    findConfigGroup: jest.fn(),
    updateConfigGroup: jest.fn(),
    removeConfigGroup: jest.fn(),
    addConfigOption: jest.fn(),
    updateConfigOption: jest.fn(),
    removeConfigOption: jest.fn(),
    setRecipe: jest.fn(),
    addRecipeItem: jest.fn(),
    updateRecipeItem: jest.fn(),
    removeRecipeItem: jest.fn(),
    countActiveUsingIngredient: jest.fn(),
    ...overrides,
  }
  return { repository, service: new ProductService(repository as unknown as ProductRepository) }
}

describe('ProductService.list (RQ-CAT-05)', () => {
  const cases: Array<{
    name: string
    docs: ProductDocument[]
    total: number
    query: ProductListQuery
  }> = [
    { name: 'sin resultados', docs: [], total: 0, query: { limit: 20, offset: 0 } },
    { name: 'una página', docs: [buildDoc()], total: 1, query: { limit: 10, offset: 5 } },
    {
      name: 'con filtros y varios productos',
      docs: [buildDoc(), buildDoc({ _id: objectId('p2') })],
      total: 42,
      query: { categoryId: 'cat1', available: true, search: 'bur', limit: 20, offset: 0 },
    },
  ]

  it.each(cases)('serializa los datos y arma el meta ($name)', async ({ docs, total, query }) => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue({ data: docs, total }),
    })

    const result = await service.list(query)

    expect(repository.list).toHaveBeenCalledWith(query)
    expect(result.meta).toEqual({ total, limit: query.limit, offset: query.offset })
    expect(result.data).toHaveLength(docs.length)
    result.data.forEach((product) => {
      expect(typeof product.id).toBe('string')
      expect(product).not.toHaveProperty('_id')
    })
  })
})

describe('ProductService.findById / findByIds / findAll', () => {
  it('findById serializa el producto encontrado', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.findById('p1')

    expect(repository.findById).toHaveBeenCalledWith('p1')
    expect(result).toMatchObject({ id: 'p1', name: 'Burger', price: 100 })
    expect(result).not.toHaveProperty('_id')
  })

  it('findById devuelve null cuando no existe', async () => {
    const { service } = makeService({ findById: jest.fn().mockResolvedValue(null) })

    await expect(service.findById('missing')).resolves.toBeNull()
  })

  it.each([
    {
      name: 'varios productos',
      docs: [buildDoc(), buildDoc({ _id: objectId('p2') })],
      expected: 2,
    },
    { name: 'un producto', docs: [buildDoc()], expected: 1 },
    { name: 'ninguno', docs: [], expected: 0 },
  ])('findByIds serializa la lista ($name)', async ({ docs, expected }) => {
    const { repository, service } = makeService({ findByIds: jest.fn().mockResolvedValue(docs) })

    const result = await service.findByIds(docs.map((doc) => doc._id.toString()))

    expect(repository.findByIds).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(expected)
    result.forEach((product) => expect(typeof product.id).toBe('string'))
  })

  it('findAll serializa todos los productos', async () => {
    const { repository, service } = makeService({
      findAll: jest.fn().mockResolvedValue([buildDoc(), buildDoc({ _id: objectId('p2') })]),
    })

    const result = await service.findAll()

    expect(repository.findAll).toHaveBeenCalledTimes(1)
    expect(result.map((product) => product.id)).toEqual(['p1', 'p2'])
  })

  it.each([
    { name: 'en uso por al menos un producto activo', count: 2, expected: true },
    { name: 'sin productos activos que lo usen', count: 0, expected: false },
  ])('isIngredientInUse ($name) → $expected', async ({ count, expected }) => {
    const { repository, service } = makeService({
      countActiveUsingIngredient: jest.fn().mockResolvedValue(count),
    })

    await expect(service.isIngredientInUse('ing1')).resolves.toBe(expected)
    expect(repository.countActiveUsingIngredient).toHaveBeenCalledWith('ing1')
  })
})

describe('ProductService.create (RQ-CAT-03/04)', () => {
  it('delega en el repositorio y serializa el producto creado', async () => {
    const { repository, service } = makeService({ create: jest.fn().mockResolvedValue(buildDoc()) })

    const data = { categoryId: 'cat1', name: 'Burger', description: 'Rica', price: 100 }
    const result = await service.create(data)

    expect(repository.create).toHaveBeenCalledWith(data)
    expect(result).toMatchObject({ id: 'p1', categoryId: 'cat1', available: true })
  })
})

describe('ProductService.update / setAvailable (RQ-CAT-03)', () => {
  it('update delega y serializa el resultado', async () => {
    const { repository, service } = makeService({
      update: jest.fn().mockResolvedValue(buildDoc({ price: 150 })),
    })

    const result = await service.update('p1', { price: 150 })

    expect(repository.update).toHaveBeenCalledWith('p1', { price: 150 })
    expect(result?.price).toBe(150)
  })

  it('update devuelve null cuando el producto no existe', async () => {
    const { service } = makeService({ update: jest.fn().mockResolvedValue(null) })

    await expect(service.update('missing', { price: 1 })).resolves.toBeNull()
  })

  it.each([
    { name: 'activar', available: true },
    { name: 'desactivar', available: false },
  ])('setAvailable $name y serializa', async ({ available }) => {
    const { repository, service } = makeService({
      setAvailable: jest.fn().mockResolvedValue(buildDoc({ available })),
    })

    const result = await service.setAvailable('p1', available)

    expect(repository.setAvailable).toHaveBeenCalledWith('p1', available)
    expect(result?.available).toBe(available)
  })

  it('setAvailable devuelve null cuando el producto no existe', async () => {
    const { service } = makeService({ setAvailable: jest.fn().mockResolvedValue(null) })

    await expect(service.setAvailable('missing', false)).resolves.toBeNull()
  })
})

describe('ProductService — grupos de configuración (RQ-CAT-06/07)', () => {
  it('addConfigGroup serializa el grupo creado', async () => {
    const { repository, service } = makeService({
      addConfigGroup: jest.fn().mockResolvedValue(buildGroup()),
    })

    const data = { name: 'Adicionales', type: CONFIG_GROUP_TYPE.multiple, required: false }
    const result = await service.addConfigGroup('p1', data)

    expect(repository.addConfigGroup).toHaveBeenCalledWith('p1', data)
    expect(result).toMatchObject({ id: 'g1', type: CONFIG_GROUP_TYPE.multiple })
    expect(result?.options[0]).toMatchObject({ id: 'opt1', name: 'Queso' })
  })

  it('addConfigGroup devuelve null si el producto no existe', async () => {
    const { service } = makeService({ addConfigGroup: jest.fn().mockResolvedValue(null) })

    await expect(
      service.addConfigGroup('missing', {
        name: 'X',
        type: CONFIG_GROUP_TYPE.single,
        required: true,
        min: 1,
      }),
    ).resolves.toBeNull()
  })

  it('updateConfigGroup serializa el grupo actualizado', async () => {
    const { repository, service } = makeService({
      findConfigGroup: jest.fn().mockResolvedValue(buildGroup()),
      updateConfigGroup: jest.fn().mockResolvedValue(buildGroup({ name: 'Nuevo' })),
    })

    const result = await service.updateConfigGroup('p1', 'g1', { name: 'Nuevo' })

    expect(repository.updateConfigGroup).toHaveBeenCalledWith('p1', 'g1', { name: 'Nuevo' })
    expect(result?.name).toBe('Nuevo')
  })

  it('updateConfigGroup devuelve null si no existe el grupo', async () => {
    const { repository, service } = makeService({
      findConfigGroup: jest.fn().mockResolvedValue(null),
      updateConfigGroup: jest.fn().mockResolvedValue(null),
    })

    await expect(service.updateConfigGroup('p1', 'missing', { name: 'X' })).resolves.toBeNull()
    expect(repository.updateConfigGroup).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'verdadero al eliminar', removed: true },
    { name: 'falso cuando no existe', removed: false },
  ])('removeConfigGroup propaga el booleano ($name)', async ({ removed }) => {
    const { repository, service } = makeService({
      removeConfigGroup: jest.fn().mockResolvedValue(removed),
    })

    await expect(service.removeConfigGroup('p1', 'g1')).resolves.toBe(removed)
    expect(repository.removeConfigGroup).toHaveBeenCalledWith('p1', 'g1')
  })

  // RQ-CAT-07 exige coherencia entre required, min y max. El servicio valida la relación
  // antes de delegar: `required: true` sin `min` y `min > max` se rechazan con 400.
  it.each([
    {
      name: 'required true sin min',
      data: { name: 'Salsas', type: CONFIG_GROUP_TYPE.single, required: true },
    },
    {
      name: 'min mayor que max',
      data: {
        name: 'Adicionales',
        type: CONFIG_GROUP_TYPE.multiple,
        required: true,
        min: 5,
        max: 1,
      },
    },
    {
      name: 'min negativo',
      data: {
        name: 'Adicionales',
        type: CONFIG_GROUP_TYPE.multiple,
        required: false,
        min: -1,
        max: 2,
      },
    },
  ])('rechaza un grupo inconsistente con VALIDATION_ERROR 400 ($name)', async ({ data }) => {
    const { repository, service } = makeService()

    await expect(service.addConfigGroup('p1', data)).rejects.toMatchObject({
      code: ERROR_CODES.validationError,
      status: 400,
    })
    expect(repository.addConfigGroup).not.toHaveBeenCalled()
  })

  it('updateConfigGroup rechaza dejar el grupo inconsistente (min > max)', async () => {
    const { repository, service } = makeService({
      findConfigGroup: jest.fn().mockResolvedValue(buildGroup({ required: false, min: 5, max: 5 })),
    })

    await expect(service.updateConfigGroup('p1', 'g1', { max: 1 })).rejects.toMatchObject({
      code: ERROR_CODES.validationError,
      status: 400,
    })
    expect(repository.updateConfigGroup).not.toHaveBeenCalled()
  })
})

describe('ProductService — opciones de configuración (RQ-CAT-06/08)', () => {
  it('addConfigOption serializa la opción creada', async () => {
    const { repository, service } = makeService({
      addConfigOption: jest.fn().mockResolvedValue(buildOption({ name: 'Bacon', extraPrice: 25 })),
    })

    const data = { name: 'Bacon', extraPrice: 25 }
    const result = await service.addConfigOption('p1', 'g1', data)

    expect(repository.addConfigOption).toHaveBeenCalledWith('p1', 'g1', data)
    expect(result).toMatchObject({ id: 'opt1', name: 'Bacon', extraPrice: 25 })
  })

  it('addConfigOption devuelve null si el grupo no existe', async () => {
    const { service } = makeService({ addConfigOption: jest.fn().mockResolvedValue(null) })

    await expect(
      service.addConfigOption('p1', 'missing', { name: 'X', extraPrice: 1 }),
    ).resolves.toBeNull()
  })

  it.each([
    { name: 'addConfigOption', price: -10 },
    { name: 'updateConfigOption', price: -1 },
  ])('rechaza extraPrice negativo con VALIDATION_ERROR 400 ($name)', async ({ name, price }) => {
    const { repository, service } = makeService()

    const promise =
      name === 'addConfigOption'
        ? service.addConfigOption('p1', 'g1', { name: 'Descuento', extraPrice: price })
        : service.updateConfigOption('p1', 'g1', 'opt1', { extraPrice: price })

    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.validationError,
      status: 400,
    })
    expect(repository.addConfigOption).not.toHaveBeenCalled()
    expect(repository.updateConfigOption).not.toHaveBeenCalled()
  })

  it('updateConfigOption serializa la opción actualizada', async () => {
    const { repository, service } = makeService({
      updateConfigOption: jest.fn().mockResolvedValue(buildOption({ available: false })),
    })

    const result = await service.updateConfigOption('p1', 'g1', 'opt1', { available: false })

    expect(repository.updateConfigOption).toHaveBeenCalledWith('p1', 'g1', 'opt1', {
      available: false,
    })
    expect(result?.available).toBe(false)
  })

  it('updateConfigOption devuelve null si la opción no existe', async () => {
    const { service } = makeService({ updateConfigOption: jest.fn().mockResolvedValue(null) })

    await expect(
      service.updateConfigOption('p1', 'g1', 'missing', { name: 'X' }),
    ).resolves.toBeNull()
  })

  it.each([
    { name: 'verdadero al eliminar', removed: true },
    { name: 'falso cuando no existe', removed: false },
  ])('removeConfigOption propaga el booleano ($name)', async ({ removed }) => {
    const { repository, service } = makeService({
      removeConfigOption: jest.fn().mockResolvedValue(removed),
    })

    await expect(service.removeConfigOption('p1', 'g1', 'opt1')).resolves.toBe(removed)
    expect(repository.removeConfigOption).toHaveBeenCalledWith('p1', 'g1', 'opt1')
  })
})

describe('ProductService — receta (RQ-CAT-11/12)', () => {
  const itemData: RecipeItemData = {
    ingredientId: 'ing-carne',
    quantity: 2,
    optionAdjustments: [{ optionId: 'opt1', quantity: 4 }],
  }

  it('setRecipe delega los ítems y serializa el producto', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      setRecipe: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.setRecipe('p1', [itemData])

    expect(repository.setRecipe).toHaveBeenCalledWith('p1', [itemData])
    expect(result?.recipe[0]).toMatchObject({
      ingredientId: 'ing1',
      optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
    })
  })

  it('setRecipe devuelve null si el producto no existe', async () => {
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue(null),
      setRecipe: jest.fn().mockResolvedValue(null),
    })

    await expect(service.setRecipe('missing', [itemData])).resolves.toBeNull()
  })

  it('addRecipeItem delega el ítem y serializa el producto', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      addRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.addRecipeItem('p1', itemData)

    expect(repository.addRecipeItem).toHaveBeenCalledWith('p1', itemData)
    expect(result?.id).toBe('p1')
  })

  it('addRecipeItem devuelve null si el producto no existe', async () => {
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue(null),
      addRecipeItem: jest.fn().mockResolvedValue(null),
    })

    await expect(service.addRecipeItem('missing', itemData)).resolves.toBeNull()
  })

  it('updateRecipeItem delega el patch y serializa el producto', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      updateRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.updateRecipeItem('p1', 'r1', itemData)

    expect(repository.updateRecipeItem).toHaveBeenCalledWith('p1', 'r1', itemData)
    expect(repository.removeRecipeItem).not.toHaveBeenCalled()
    expect(result?.recipe).toHaveLength(1)
  })

  // RQ-CAT-11: reasignar un ítem a un ingrediente ya presente no debe reintroducir
  // duplicados; se fusionan las cantidades y se elimina el ítem duplicado.
  it('updateRecipeItem fusiona cuando el ingrediente ya existe en otro ítem', async () => {
    const recipe = [
      buildRecipeItem({
        _id: objectId('r1'),
        ingredientId: 'ing1',
        quantity: 2,
        optionAdjustments: [],
      }),
      buildRecipeItem({
        _id: objectId('r2'),
        ingredientId: 'ing-carne',
        quantity: 3,
        optionAdjustments: [],
      }),
    ]
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc({ recipe })),
      updateRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
      removeRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    await service.updateRecipeItem('p1', 'r1', { ingredientId: 'ing-carne', quantity: 5 })

    expect(repository.updateRecipeItem).toHaveBeenCalledWith('p1', 'r1', {
      ingredientId: 'ing-carne',
      quantity: 8,
      optionAdjustments: [],
    })
    expect(repository.removeRecipeItem).toHaveBeenCalledWith('p1', 'r2')
  })

  it('updateRecipeItem devuelve null si el ítem no existe', async () => {
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      updateRecipeItem: jest.fn().mockResolvedValue(null),
    })

    await expect(service.updateRecipeItem('p1', 'missing', itemData)).resolves.toBeNull()
  })

  it('removeRecipeItem delega y serializa el producto', async () => {
    const { repository, service } = makeService({
      removeRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    const result = await service.removeRecipeItem('p1', 'r1')

    expect(repository.removeRecipeItem).toHaveBeenCalledWith('p1', 'r1')
    expect(result?.id).toBe('p1')
  })

  it('removeRecipeItem devuelve null si el producto no existe', async () => {
    const { service } = makeService({ removeRecipeItem: jest.fn().mockResolvedValue(null) })

    await expect(service.removeRecipeItem('missing', 'r1')).resolves.toBeNull()
  })

  // RQ-CAT-11 exige cantidad > 0. El servicio valida cantidad base y ajustes por opción
  // antes de delegar, rechazando 0 y negativos con 400 VALIDATION_ERROR.
  it.each([
    { name: 'setRecipe cantidad 0', quantity: 0 },
    { name: 'setRecipe cantidad negativa', quantity: -3 },
  ])('rechaza cantidad no positiva con VALIDATION_ERROR 400 ($name)', async ({ quantity }) => {
    const { repository, service } = makeService()

    await expect(
      service.setRecipe('p1', [{ ingredientId: 'ing1', quantity }]),
    ).rejects.toMatchObject({ code: ERROR_CODES.validationError, status: 400 })
    expect(repository.setRecipe).not.toHaveBeenCalled()
  })

  it('rechaza un ajuste por opción con cantidad 0', async () => {
    const { service } = makeService()

    await expect(
      service.addRecipeItem('p1', {
        ingredientId: 'ing1',
        quantity: 1,
        optionAdjustments: [{ optionId: 'opt1', quantity: 0 }],
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.validationError, status: 400 })
  })

  it.each([
    { name: 'cantidad 0', quantity: 0 },
    { name: 'cantidad negativa', quantity: -2 },
  ])('updateRecipeItem rechaza cantidad no positiva ($name)', async ({ quantity }) => {
    const { service } = makeService()

    await expect(
      service.updateRecipeItem('p1', 'r1', { ingredientId: 'ing1', quantity }),
    ).rejects.toMatchObject({ code: ERROR_CODES.validationError, status: 400 })
  })

  // RQ-CAT-11: la receta no debe contener el mismo ingrediente dos veces; las
  // cantidades se fusionan sumando (y los ajustes por opción se acumulan).
  it('setRecipe fusiona ingredientes repetidos sumando cantidades y ajustes', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      setRecipe: jest.fn().mockResolvedValue(buildDoc()),
    })

    const items: RecipeItemData[] = [
      {
        ingredientId: 'ing-carne',
        quantity: 1,
        optionAdjustments: [{ optionId: 'opt1', quantity: 2 }],
      },
      { ingredientId: 'ing-pan', quantity: 3 },
      {
        ingredientId: 'ing-carne',
        quantity: 4,
        optionAdjustments: [{ optionId: 'opt1', quantity: 1 }],
      },
    ]

    await service.setRecipe('p1', items)

    expect(repository.setRecipe).toHaveBeenCalledWith('p1', [
      {
        ingredientId: 'ing-carne',
        quantity: 5,
        optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
      },
      { ingredientId: 'ing-pan', quantity: 3, optionAdjustments: [] },
    ])
  })

  it('setRecipe no deja ingredientes duplicados aunque el input los repita', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc({ configGroups: [] })),
      setRecipe: jest.fn().mockResolvedValue(buildDoc()),
    })

    await service.setRecipe('p1', [
      { ingredientId: 'ing1', quantity: 2 },
      { ingredientId: 'ing1', quantity: 3 },
    ])

    const [, calledItems] = repository.setRecipe.mock.calls[0] as [string, RecipeItemData[]]
    expect(calledItems).toHaveLength(1)
    expect(calledItems[0]).toMatchObject({ ingredientId: 'ing1', quantity: 5 })
  })

  it('addRecipeItem fusiona con el ítem existente del mismo ingrediente (update, no push)', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      updateRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
      addRecipeItem: jest.fn(),
    })

    await service.addRecipeItem('p1', { ingredientId: 'ing1', quantity: 5 })

    expect(repository.addRecipeItem).not.toHaveBeenCalled()
    expect(repository.updateRecipeItem).toHaveBeenCalledWith('p1', 'r1', {
      ingredientId: 'ing1',
      quantity: 7,
      optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
    })
  })

  it('addRecipeItem agrega un ingrediente nuevo sin fusionar', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      addRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    await service.addRecipeItem('p1', { ingredientId: 'ing-carne', quantity: 1 })

    expect(repository.addRecipeItem).toHaveBeenCalledWith('p1', {
      ingredientId: 'ing-carne',
      quantity: 1,
    })
    expect(repository.updateRecipeItem).not.toHaveBeenCalled()
  })

  // RQ-CAT-12: los ajustes por opción deben referenciar opciones existentes del producto.
  it.each([
    {
      name: 'setRecipe',
      run: (service: ProductService) =>
        service.setRecipe('p1', [
          {
            ingredientId: 'ing1',
            quantity: 1,
            optionAdjustments: [{ optionId: 'ghost', quantity: 2 }],
          },
        ]),
    },
    {
      name: 'addRecipeItem',
      run: (service: ProductService) =>
        service.addRecipeItem('p1', {
          ingredientId: 'ing1',
          quantity: 1,
          optionAdjustments: [{ optionId: 'ghost', quantity: 2 }],
        }),
    },
    {
      name: 'updateRecipeItem',
      run: (service: ProductService) =>
        service.updateRecipeItem('p1', 'r1', {
          ingredientId: 'ing1',
          quantity: 1,
          optionAdjustments: [{ optionId: 'ghost', quantity: 2 }],
        }),
    },
  ])(
    'rechaza con OPTION_NOT_FOUND 404 cuando el ajuste apunta a una opción inexistente ($name)',
    async ({ run }) => {
      const { repository, service } = makeService({
        findById: jest.fn().mockResolvedValue(buildDoc()),
      })

      await expect(run(service)).rejects.toMatchObject({
        code: OPTION_NOT_FOUND,
        status: 404,
      })
      expect(repository.setRecipe).not.toHaveBeenCalled()
      expect(repository.addRecipeItem).not.toHaveBeenCalled()
      expect(repository.updateRecipeItem).not.toHaveBeenCalled()
    },
  )

  it('acepta ajustes que referencian opciones existentes del producto', async () => {
    const { service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc()),
      setRecipe: jest.fn().mockResolvedValue(buildDoc()),
    })

    await expect(
      service.setRecipe('p1', [
        {
          ingredientId: 'ing1',
          quantity: 1,
          optionAdjustments: [{ optionId: 'opt1', quantity: 2 }],
        },
      ]),
    ).resolves.toBeDefined()
  })

  it('no valida opciones cuando la receta no tiene ajustes', async () => {
    const { repository, service } = makeService({
      findById: jest.fn().mockResolvedValue(buildDoc({ configGroups: [] })),
      addRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    await expect(
      service.addRecipeItem('p1', { ingredientId: 'ing-nuevo', quantity: 1 }),
    ).resolves.toBeDefined()
    expect(repository.addRecipeItem).toHaveBeenCalledWith('p1', {
      ingredientId: 'ing-nuevo',
      quantity: 1,
    })
  })
})
