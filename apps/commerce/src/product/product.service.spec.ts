import type { Types } from 'mongoose'
import { CONFIG_GROUP_TYPE } from '../config/constants'
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
  return { repository, service: new ProductService(repository as unknown as ProductRepository) }
}

describe('ProductService.list (RQ-CAT-05)', () => {
  const cases: Array<{ name: string; docs: ProductDocument[]; total: number; query: ProductListQuery }> = [
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
    const { repository, service } = makeService({ list: jest.fn().mockResolvedValue({ data: docs, total }) })

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
    const { repository, service } = makeService({ findById: jest.fn().mockResolvedValue(buildDoc()) })

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
    { name: 'varios productos', docs: [buildDoc(), buildDoc({ _id: objectId('p2') })], expected: 2 },
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
})

describe('ProductService.create (RQ-CAT-03/04)', () => {
  it('delega en el repositorio y serializa el producto creado', async () => {
    const { repository, service } = makeService({ create: jest.fn().mockResolvedValue(buildDoc()) })

    const data = { categoryId: 'cat1', name: 'Burger', description: 'Rica', price: 100 }
    const result = await service.create(data)

    expect(repository.create).toHaveBeenCalledWith(data)
    expect(result).toMatchObject({ id: 'p1', categoryId: 'cat1', available: true })
  })

  // KNOWN BUG: RQ-CAT-04 exige que la categoría exista al crear un producto y el contrato
  // define CATEGORY_NOT_FOUND. ProductService no inyecta CategoryService/CategoryRepository
  // (sólo ProductRepository) y delega directo, por lo que crear con un categoryId inexistente
  // resuelve sin error en lugar de lanzar CATEGORY_NOT_FOUND 404.
  it('KNOWN BUG: crea un producto con categoría inexistente sin lanzar CATEGORY_NOT_FOUND', async () => {
    const { repository, service } = makeService({
      create: jest.fn().mockResolvedValue(buildDoc({ categoryId: 'missing' })),
    })

    const result = await service.create({
      categoryId: 'missing',
      name: 'Fantasma',
      description: 'Sin categoría',
      price: 10,
    })

    expect(repository.create).toHaveBeenCalledWith({
      categoryId: 'missing',
      name: 'Fantasma',
      description: 'Sin categoría',
      price: 10,
    })
    expect(result.categoryId).toBe('missing')
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
      service.addConfigGroup('missing', { name: 'X', type: CONFIG_GROUP_TYPE.single, required: true }),
    ).resolves.toBeNull()
  })

  it('updateConfigGroup serializa el grupo actualizado', async () => {
    const { repository, service } = makeService({
      updateConfigGroup: jest.fn().mockResolvedValue(buildGroup({ name: 'Nuevo' })),
    })

    const result = await service.updateConfigGroup('p1', 'g1', { name: 'Nuevo' })

    expect(repository.updateConfigGroup).toHaveBeenCalledWith('p1', 'g1', { name: 'Nuevo' })
    expect(result?.name).toBe('Nuevo')
  })

  it('updateConfigGroup devuelve null si no existe el grupo', async () => {
    const { service } = makeService({ updateConfigGroup: jest.fn().mockResolvedValue(null) })

    await expect(service.updateConfigGroup('p1', 'missing', { name: 'X' })).resolves.toBeNull()
  })

  it.each([
    { name: 'verdadero al eliminar', removed: true },
    { name: 'falso cuando no existe', removed: false },
  ])('removeConfigGroup propaga el booleano ($name)', async ({ removed }) => {
    const { repository, service } = makeService({ removeConfigGroup: jest.fn().mockResolvedValue(removed) })

    await expect(service.removeConfigGroup('p1', 'g1')).resolves.toBe(removed)
    expect(repository.removeConfigGroup).toHaveBeenCalledWith('p1', 'g1')
  })

  // KNOWN BUG: RQ-CAT-07 exige coherencia entre required, min y max de una configuración.
  // No hay validación cruzada: `required: true` sin `min`, o `min > max`, se aceptan y se
  // delegan al repositorio sin lanzar error de dominio (VALIDATION_ERROR / 400).
  it.each([
    {
      name: 'required true sin min',
      data: { name: 'Salsas', type: CONFIG_GROUP_TYPE.single, required: true },
    },
    {
      name: 'min mayor que max',
      data: { name: 'Adicionales', type: CONFIG_GROUP_TYPE.multiple, required: true, min: 5, max: 1 },
    },
    {
      name: 'min negativo',
      data: { name: 'Adicionales', type: CONFIG_GROUP_TYPE.multiple, required: false, min: -1, max: 2 },
    },
  ])('KNOWN BUG: acepta un grupo inconsistente ($name)', async ({ data }) => {
    const { repository, service } = makeService({
      addConfigGroup: jest.fn().mockResolvedValue(buildGroup(data)),
    })

    await expect(service.addConfigGroup('p1', data)).resolves.toBeDefined()
    expect(repository.addConfigGroup).toHaveBeenCalledWith('p1', data)
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

    await expect(service.addConfigOption('p1', 'missing', { name: 'X', extraPrice: 1 })).resolves.toBeNull()
  })

  it('updateConfigOption serializa la opción actualizada', async () => {
    const { repository, service } = makeService({
      updateConfigOption: jest.fn().mockResolvedValue(buildOption({ available: false })),
    })

    const result = await service.updateConfigOption('p1', 'g1', 'opt1', { available: false })

    expect(repository.updateConfigOption).toHaveBeenCalledWith('p1', 'g1', 'opt1', { available: false })
    expect(result?.available).toBe(false)
  })

  it('updateConfigOption devuelve null si la opción no existe', async () => {
    const { service } = makeService({ updateConfigOption: jest.fn().mockResolvedValue(null) })

    await expect(service.updateConfigOption('p1', 'g1', 'missing', { name: 'X' })).resolves.toBeNull()
  })

  it.each([
    { name: 'verdadero al eliminar', removed: true },
    { name: 'falso cuando no existe', removed: false },
  ])('removeConfigOption propaga el booleano ($name)', async ({ removed }) => {
    const { repository, service } = makeService({ removeConfigOption: jest.fn().mockResolvedValue(removed) })

    await expect(service.removeConfigOption('p1', 'g1', 'opt1')).resolves.toBe(removed)
    expect(repository.removeConfigOption).toHaveBeenCalledWith('p1', 'g1', 'opt1')
  })
})

describe('ProductService — receta (RQ-CAT-11/12)', () => {
  const itemData: RecipeItemData = {
    ingredientId: 'ing-carne',
    quantity: 2,
    optionAdjustments: [{ optionId: 'opt-doble', quantity: 4 }],
  }

  it('setRecipe delega los ítems y serializa el producto', async () => {
    const { repository, service } = makeService({ setRecipe: jest.fn().mockResolvedValue(buildDoc()) })

    const result = await service.setRecipe('p1', [itemData])

    expect(repository.setRecipe).toHaveBeenCalledWith('p1', [itemData])
    expect(result?.recipe[0]).toMatchObject({
      ingredientId: 'ing1',
      optionAdjustments: [{ optionId: 'opt1', quantity: 3 }],
    })
  })

  it('setRecipe devuelve null si el producto no existe', async () => {
    const { service } = makeService({ setRecipe: jest.fn().mockResolvedValue(null) })

    await expect(service.setRecipe('missing', [itemData])).resolves.toBeNull()
  })

  it('addRecipeItem delega el ítem y serializa el producto', async () => {
    const { repository, service } = makeService({ addRecipeItem: jest.fn().mockResolvedValue(buildDoc()) })

    const result = await service.addRecipeItem('p1', itemData)

    expect(repository.addRecipeItem).toHaveBeenCalledWith('p1', itemData)
    expect(result?.id).toBe('p1')
  })

  it('addRecipeItem devuelve null si el producto no existe', async () => {
    const { service } = makeService({ addRecipeItem: jest.fn().mockResolvedValue(null) })

    await expect(service.addRecipeItem('missing', itemData)).resolves.toBeNull()
  })

  it('updateRecipeItem delega el patch y serializa el producto', async () => {
    const { repository, service } = makeService({ updateRecipeItem: jest.fn().mockResolvedValue(buildDoc()) })

    const result = await service.updateRecipeItem('p1', 'r1', itemData)

    expect(repository.updateRecipeItem).toHaveBeenCalledWith('p1', 'r1', itemData)
    expect(result?.recipe).toHaveLength(1)
  })

  it('updateRecipeItem devuelve null si el ítem no existe', async () => {
    const { service } = makeService({ updateRecipeItem: jest.fn().mockResolvedValue(null) })

    await expect(service.updateRecipeItem('p1', 'missing', itemData)).resolves.toBeNull()
  })

  it('removeRecipeItem delega y serializa el producto', async () => {
    const { repository, service } = makeService({ removeRecipeItem: jest.fn().mockResolvedValue(buildDoc()) })

    const result = await service.removeRecipeItem('p1', 'r1')

    expect(repository.removeRecipeItem).toHaveBeenCalledWith('p1', 'r1')
    expect(result?.id).toBe('p1')
  })

  it('removeRecipeItem devuelve null si el producto no existe', async () => {
    const { service } = makeService({ removeRecipeItem: jest.fn().mockResolvedValue(null) })

    await expect(service.removeRecipeItem('missing', 'r1')).resolves.toBeNull()
  })

  // KNOWN BUG: RQ-CAT-11 exige validar que el ingrediente exista (INGREDIENT_NOT_FOUND).
  // ProductService no inyecta IngredientService/IngredientRepository y delega directo, así
  // que se aceptan ingredientes inexistentes sin lanzar error de dominio.
  it('KNOWN BUG: setRecipe acepta ingredientes inexistentes sin lanzar INGREDIENT_NOT_FOUND', async () => {
    const { repository, service } = makeService({
      setRecipe: jest.fn().mockResolvedValue(buildDoc({ recipe: [] })),
    })

    await expect(
      service.setRecipe('p1', [{ ingredientId: 'ing-fantasma', quantity: 1 }]),
    ).resolves.toBeDefined()
    expect(repository.setRecipe).toHaveBeenCalledWith('p1', [{ ingredientId: 'ing-fantasma', quantity: 1 }])
  })

  // KNOWN BUG: la cantidad de un ingrediente debería ser > 0. El DTO usa @Min(0) y el
  // servicio/repositorio no validan, por lo que cantidad 0 se acepta en la receta.
  it.each([
    { name: 'cantidad 0', quantity: 0 },
    { name: 'cantidad negativa', quantity: -3 },
  ])('KNOWN BUG: setRecipe acepta cantidad no positiva ($name)', async ({ quantity }) => {
    const { service } = makeService({ setRecipe: jest.fn().mockResolvedValue(buildDoc()) })

    await expect(service.setRecipe('p1', [{ ingredientId: 'ing1', quantity }])).resolves.toBeDefined()
  })

  // KNOWN BUG: no hay deduplicación ni fusión de ingredientes repetidos. La misma
  // ingrediente puede quedar dos veces en la receta, duplicando el requerimiento de stock.
  it('KNOWN BUG: agrega ingredientes duplicados sin deduplicar', async () => {
    const duplicated: RecipeItemData[] = [
      { ingredientId: 'ing-carne', quantity: 1 },
      { ingredientId: 'ing-carne', quantity: 1 },
    ]
    const { repository, service } = makeService({
      addRecipeItem: jest.fn().mockResolvedValue(buildDoc()),
    })

    await service.addRecipeItem('p1', duplicated[1])

    expect(repository.addRecipeItem).toHaveBeenCalledWith('p1', duplicated[1])
  })
})
