import type { Model, Types } from 'mongoose'
import { CONFIG_GROUP_TYPE } from '../config/constants'
import type { ConfigGroup, ConfigOption, ProductDocument, RecipeItem } from './product.model'
import { ProductRepository } from './product.repository'

interface QueryChain<T> {
  sort: jest.Mock
  skip: jest.Mock
  limit: jest.Mock
  exec: jest.Mock<Promise<T>, []>
}

const chainable = <T>(result: T): QueryChain<T> => {
  const chain: QueryChain<T> = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  }
  chain.sort.mockReturnValue(chain)
  chain.skip.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}

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
    save: jest.fn(function (this: ProductDocument) {
      return Promise.resolve(this)
    }),
    ...overrides,
  }) as unknown as ProductDocument

const makeRepository = () => {
  const model = {
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  return { model, repository: new ProductRepository(model as unknown as Model<ProductDocument>) }
}

describe('ProductRepository.findById / findByIds / findAll', () => {
  it.each([
    { name: 'id de 24 hex', id: '507f1f77bcf86cd799439011' },
    { name: 'id corto', id: 'p1' },
    { name: 'id con formato arbitrario', id: 'producto-1' },
  ])('findById delega en el modelo con el id sin transformarlo ($name)', async ({ id }) => {
    const { model, repository } = makeRepository()
    const doc = buildDoc()
    model.findById.mockReturnValue(chainable(doc))

    await expect(repository.findById(id)).resolves.toBe(doc)
    expect(model.findById).toHaveBeenCalledWith(id)
  })

  it('findById devuelve null cuando no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.findById('missing')).resolves.toBeNull()
  })

  it.each([
    { name: 'varios ids', ids: ['p1', 'p2'] },
    { name: 'un solo id', ids: ['p1'] },
    { name: 'lista vacía', ids: [] },
  ])('findByIds consulta por $in ($name)', async ({ ids }) => {
    const { model, repository } = makeRepository()
    const docs = ids.map((id) => buildDoc({ _id: objectId(id) }))
    model.find.mockReturnValue(chainable(docs))

    await expect(repository.findByIds(ids)).resolves.toBe(docs)
    expect(model.find).toHaveBeenCalledWith({ _id: { $in: ids } })
  })

  it('findAll ordena por nombre ascendente', async () => {
    const { model, repository } = makeRepository()
    const sort = chainable([buildDoc()])
    model.find.mockReturnValue(sort)

    await repository.findAll()

    expect(model.find).toHaveBeenCalledWith()
    expect(sort.sort).toHaveBeenCalledWith({ name: 1 })
  })
})

describe('ProductRepository.create (RQ-CAT-04)', () => {
  it.each([
    {
      name: 'sin opcionales aplica defaults',
      input: { categoryId: 'cat1', name: 'Burger', description: 'Rica', price: 100 },
      expected: { image: null, available: true, configGroups: [], recipe: [] },
    },
    {
      name: 'respeta image, precio 0 y available false',
      input: {
        categoryId: 'cat1',
        name: 'Agua',
        description: 'Fría',
        price: 0,
        image: 'https://cdn.test/agua.png',
        available: false,
      },
      expected: {
        image: 'https://cdn.test/agua.png',
        available: false,
        configGroups: [],
        recipe: [],
      },
    },
    {
      name: 'available true explícito',
      input: {
        categoryId: 'cat1',
        name: 'Jugo',
        description: 'Natural',
        price: 50,
        available: true,
      },
      expected: { image: null, available: true, configGroups: [], recipe: [] },
    },
  ])('$name', async ({ input, expected }) => {
    const { model, repository } = makeRepository()
    const doc = buildDoc()
    model.create.mockResolvedValue(doc)

    const result = await repository.create(input)

    expect(result).toBe(doc)
    expect(model.create).toHaveBeenCalledWith({ ...input, ...expected })
  })
})

describe('ProductRepository.list — filtros (RQ-CAT-05)', () => {
  it.each([
    { name: 'sin filtros', query: { limit: 20, offset: 0 }, expected: {} },
    {
      name: 'por categoría',
      query: { categoryId: 'cat1', limit: 20, offset: 0 },
      expected: { categoryId: 'cat1' },
    },
    {
      name: 'solo disponibles',
      query: { available: true, limit: 20, offset: 0 },
      expected: { available: true },
    },
    {
      name: 'solo no disponibles (false no se descarta)',
      query: { available: false, limit: 20, offset: 0 },
      expected: { available: false },
    },
    {
      name: 'por búsqueda',
      query: { search: 'pizza', limit: 20, offset: 0 },
      expected: { name: /pizza/i },
    },
    {
      name: 'combinando categoría, disponibilidad y búsqueda',
      query: { categoryId: 'cat1', available: false, search: 'bur', limit: 5, offset: 10 },
      expected: { categoryId: 'cat1', available: false, name: /bur/i },
    },
  ])('construye el filtro ($name)', async ({ query, expected }) => {
    const { model, repository } = makeRepository()
    const data = [buildDoc()]
    const findChain = chainable(data)
    model.find.mockReturnValue(findChain)
    model.countDocuments.mockReturnValue(chainable(1))

    const result = await repository.list(query)

    expect(model.find).toHaveBeenCalledWith(expected)
    expect(model.countDocuments).toHaveBeenCalledWith(expected)
    expect(findChain.sort).toHaveBeenCalledWith({ name: 1 })
    expect(findChain.skip).toHaveBeenCalledWith(query.offset)
    expect(findChain.limit).toHaveBeenCalledWith(query.limit)
    expect(result).toEqual({ data, total: 1 })
  })

  it.each([
    { name: 'punto y signo más', input: 'a+b.c', expected: 'a\\+b\\.c' },
    { name: 'paréntesis y corchetes', input: '(x)[y]', expected: '\\(x\\)\\[y\\]' },
    { name: 'texto simple', input: 'bebidas', expected: 'bebidas' },
    { name: 'caracteres de ancla y moneda', input: '^$100', expected: '\\^\\$100' },
  ])('escapa metacaracteres de regex en la búsqueda ($name)', async ({ input, expected }) => {
    const { model, repository } = makeRepository()
    model.find.mockReturnValue(chainable([]))
    model.countDocuments.mockReturnValue(chainable(0))

    await repository.list({ search: input, limit: 20, offset: 0 })

    const [filter] = model.find.mock.calls[0] as [Record<string, unknown>]
    const pattern = filter.name as RegExp
    expect(pattern).toBeInstanceOf(RegExp)
    expect(pattern.source).toBe(expected)
    expect(pattern.flags).toBe('i')
  })
})

describe('ProductRepository.update / setAvailable (RQ-CAT-03)', () => {
  it.each([
    { name: 'precio', patch: { price: 150 } },
    { name: 'nombre', patch: { name: 'Nuevo nombre' } },
    { name: 'categoría', patch: { categoryId: 'cat2' } },
    { name: 'precio 0 (límite)', patch: { price: 0 } },
    { name: 'varios campos', patch: { price: 200, description: 'Otra' } },
  ])('update aplica $set en $name y devuelve el nuevo documento', async ({ patch }) => {
    const { model, repository } = makeRepository()
    const doc = buildDoc()
    model.findByIdAndUpdate.mockReturnValue(chainable(doc))

    await expect(repository.update('p1', patch)).resolves.toBe(doc)
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith('p1', { $set: patch }, { new: true })
  })

  it('update devuelve null si no existe', async () => {
    const { model, repository } = makeRepository()
    model.findByIdAndUpdate.mockReturnValue(chainable(null))

    await expect(repository.update('missing', { price: 1 })).resolves.toBeNull()
  })

  it.each([
    { name: 'activar', available: true },
    { name: 'desactivar', available: false },
  ])('setAvailable $name usando $set', async ({ available }) => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ available })
    model.findByIdAndUpdate.mockReturnValue(chainable(doc))

    await expect(repository.setAvailable('p1', available)).resolves.toBe(doc)
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'p1',
      { $set: { available } },
      { new: true },
    )
  })
})

describe('ProductRepository.addConfigGroup (RQ-CAT-06/07)', () => {
  it('agrega el grupo con min/max null y opciones vacías por defecto', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ configGroups: [] })
    model.findById.mockReturnValue(chainable(doc))

    const group = await repository.addConfigGroup('p1', {
      name: 'Tamaño',
      type: CONFIG_GROUP_TYPE.single,
      required: true,
    })

    expect(group).toEqual({
      name: 'Tamaño',
      type: CONFIG_GROUP_TYPE.single,
      required: true,
      min: null,
      max: null,
      options: [],
    })
    expect(doc.configGroups).toHaveLength(1)
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('respeta min y max provistos', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ configGroups: [] })
    model.findById.mockReturnValue(chainable(doc))

    const group = await repository.addConfigGroup('p1', {
      name: 'Adicionales',
      type: CONFIG_GROUP_TYPE.multiple,
      required: false,
      min: 0,
      max: 3,
    })

    expect(group).toEqual(expect.objectContaining({ min: 0, max: 3 }))
  })

  it('devuelve null y no guarda si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(
      repository.addConfigGroup('missing', {
        name: 'Tamaño',
        type: CONFIG_GROUP_TYPE.single,
        required: true,
      }),
    ).resolves.toBeNull()
  })
})

describe('ProductRepository.updateConfigGroup (RQ-CAT-07)', () => {
  it.each([
    { name: 'nombre', patch: { name: 'Nuevo' } },
    { name: 'tipo', patch: { type: CONFIG_GROUP_TYPE.single } },
    { name: 'required', patch: { required: false } },
    { name: 'min y max', patch: { min: 1, max: 5 } },
    { name: 'limpiar min y max con null', patch: { min: null, max: null } },
  ])('actualiza $name', async ({ patch }) => {
    const { model, repository } = makeRepository()
    const group = buildGroup()
    const doc = buildDoc({ configGroups: [group] })
    model.findById.mockReturnValue(chainable(doc))

    const result = await repository.updateConfigGroup('p1', 'g1', patch)

    expect(result).toBe(group)
    expect(group).toEqual(expect.objectContaining(patch))
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('resuelve el grupo comparando el _id stringificado (id casting)', async () => {
    const { model, repository } = makeRepository()
    const group = buildGroup({ _id: objectId('507f1f77bcf86cd799439011') })
    const doc = buildDoc({ configGroups: [group] })
    model.findById.mockReturnValue(chainable(doc))

    const result = await repository.updateConfigGroup('p1', '507f1f77bcf86cd799439011', {
      name: 'Renombrado',
    })

    expect(result).toBe(group)
    expect(group.name).toBe('Renombrado')
  })

  const notFoundCases: Array<{
    name: string
    productId?: string
    groupId: string
    missingProduct?: boolean
  }> = [
    { name: 'el grupo no existe', groupId: 'missing' },
    { name: 'el producto no existe', productId: 'missing', groupId: 'g1', missingProduct: true },
  ]

  it.each(notFoundCases)(
    'devuelve null y no guarda cuando $name',
    async ({ productId = 'p1', groupId, missingProduct }) => {
      const { model, repository } = makeRepository()
      const doc = buildDoc({ configGroups: [buildGroup()] })
      model.findById.mockReturnValue(chainable(missingProduct ? null : doc))

      await expect(
        repository.updateConfigGroup(productId, groupId, { name: 'X' }),
      ).resolves.toBeNull()
      expect(doc.save).not.toHaveBeenCalled()
    },
  )
})

describe('ProductRepository.removeConfigGroup (RQ-CAT-06)', () => {
  it('elimina el grupo junto con sus opciones y devuelve true', async () => {
    const { model, repository } = makeRepository()
    const group = buildGroup({ options: [buildOption(), buildOption({ _id: objectId('opt2') })] })
    const doc = buildDoc({ configGroups: [group, buildGroup({ _id: objectId('g2') })] })
    model.findById.mockReturnValue(chainable(doc))

    await expect(repository.removeConfigGroup('p1', 'g1')).resolves.toBe(true)

    expect(doc.configGroups).toHaveLength(1)
    expect(doc.configGroups[0]._id?.toString()).toBe('g2')
    expect(doc.configGroups.find((entry) => entry._id?.toString() === 'g1')).toBeUndefined()
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('devuelve false y no guarda si el grupo no existe', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ configGroups: [buildGroup()] })
    model.findById.mockReturnValue(chainable(doc))

    await expect(repository.removeConfigGroup('p1', 'missing')).resolves.toBe(false)
    expect(doc.configGroups).toHaveLength(1)
    expect(doc.save).not.toHaveBeenCalled()
  })

  it('devuelve false si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.removeConfigGroup('missing', 'g1')).resolves.toBe(false)
  })
})

describe('ProductRepository.addConfigOption (RQ-CAT-06/08)', () => {
  it.each([
    {
      name: 'aplica available true por defecto',
      data: { name: 'Sin cebolla', extraPrice: 0 },
      expected: { available: true },
    },
    {
      name: 'respeta available false',
      data: { name: 'Extra bacon', extraPrice: 25, available: false },
      expected: { available: false },
    },
  ])('agrega la opción ($name)', async ({ data, expected }) => {
    const { model, repository } = makeRepository()
    const group = buildGroup({ options: [] })
    const doc = buildDoc({ configGroups: [group] })
    model.findById.mockReturnValue(chainable(doc))

    const option = await repository.addConfigOption('p1', 'g1', data)

    expect(option).toEqual(expect.objectContaining({ ...data, ...expected }))
    expect(group.options).toHaveLength(1)
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('devuelve null y no guarda si el grupo no existe', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ configGroups: [buildGroup()] })
    model.findById.mockReturnValue(chainable(doc))

    await expect(
      repository.addConfigOption('p1', 'missing', { name: 'X', extraPrice: 1 }),
    ).resolves.toBeNull()
    expect(doc.save).not.toHaveBeenCalled()
  })

  it('devuelve null si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(
      repository.addConfigOption('missing', 'g1', { name: 'X', extraPrice: 1 }),
    ).resolves.toBeNull()
  })
})

describe('ProductRepository.updateConfigOption (RQ-CAT-06/08)', () => {
  it.each([
    { name: 'nombre', patch: { name: 'Nuevo' } },
    { name: 'precio extra', patch: { extraPrice: 5 } },
    { name: 'precio extra 0', patch: { extraPrice: 0 } },
    { name: 'disponibilidad', patch: { available: false } },
  ])('actualiza $name', async ({ patch }) => {
    const { model, repository } = makeRepository()
    const option = buildOption()
    const group = buildGroup({ options: [option] })
    const doc = buildDoc({ configGroups: [group] })
    model.findById.mockReturnValue(chainable(doc))

    const result = await repository.updateConfigOption('p1', 'g1', 'opt1', patch)

    expect(result).toBe(option)
    expect(option).toEqual(expect.objectContaining(patch))
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  const notFoundCases: Array<{
    name: string
    productId?: string
    groupId?: string
    optionId: string
    missingProduct?: boolean
  }> = [
    { name: 'la opción no existe', optionId: 'missing' },
    { name: 'el grupo no existe', groupId: 'missing', optionId: 'opt1' },
    {
      name: 'el producto no existe',
      productId: 'missing',
      groupId: 'g1',
      optionId: 'opt1',
      missingProduct: true,
    },
  ]

  it.each(notFoundCases)(
    'devuelve null y no guarda cuando $name',
    async ({ productId = 'p1', groupId = 'g1', optionId, missingProduct }) => {
      const { model, repository } = makeRepository()
      const doc = buildDoc()
      model.findById.mockReturnValue(chainable(missingProduct ? null : doc))

      await expect(
        repository.updateConfigOption(productId, groupId, optionId, { name: 'X' }),
      ).resolves.toBeNull()
      expect(doc.save).not.toHaveBeenCalled()
    },
  )
})

describe('ProductRepository.removeConfigOption (RQ-CAT-06)', () => {
  it('elimina la opción y devuelve true', async () => {
    const { model, repository } = makeRepository()
    const group = buildGroup({ options: [buildOption(), buildOption({ _id: objectId('opt2') })] })
    const doc = buildDoc({ configGroups: [group] })
    model.findById.mockReturnValue(chainable(doc))

    await expect(repository.removeConfigOption('p1', 'g1', 'opt1')).resolves.toBe(true)

    expect(group.options).toHaveLength(1)
    expect(group.options[0]._id?.toString()).toBe('opt2')
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  const notFoundCases: Array<{ name: string; groupId?: string; optionId: string }> = [
    { name: 'la opción no existe', optionId: 'missing' },
    { name: 'el grupo no existe', groupId: 'missing', optionId: 'opt1' },
  ]

  it.each(notFoundCases)(
    'devuelve false y no guarda cuando $name',
    async ({ groupId = 'g1', optionId }) => {
      const { model, repository } = makeRepository()
      const doc = buildDoc()
      model.findById.mockReturnValue(chainable(doc))

      await expect(repository.removeConfigOption('p1', groupId, optionId)).resolves.toBe(false)
      expect(doc.save).not.toHaveBeenCalled()
    },
  )

  it('devuelve false si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.removeConfigOption('missing', 'g1', 'opt1')).resolves.toBe(false)
  })
})

describe('ProductRepository.setRecipe (RQ-CAT-11/12)', () => {
  it('reemplaza la receta completa (no agrega a la existente)', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ recipe: [buildRecipeItem({ ingredientId: 'viejo' })] })
    model.findById.mockReturnValue(chainable(doc))

    const items = [
      { ingredientId: 'ing2', quantity: 3, optionAdjustments: [{ optionId: 'opt2', quantity: 5 }] },
    ]
    const result = await repository.setRecipe('p1', items)

    expect(result).toBe(doc)
    expect(doc.recipe).toEqual(items)
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('normaliza optionAdjustments ausente a lista vacía', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ recipe: [] })
    model.findById.mockReturnValue(chainable(doc))

    await repository.setRecipe('p1', [{ ingredientId: 'ing2', quantity: 3 }])

    expect(doc.recipe).toEqual([{ ingredientId: 'ing2', quantity: 3, optionAdjustments: [] }])
  })

  it('permite reemplazar la receta por una lista vacía', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ recipe: [buildRecipeItem()] })
    model.findById.mockReturnValue(chainable(doc))

    await repository.setRecipe('p1', [])

    expect(doc.recipe).toEqual([])
  })

  it('devuelve null si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.setRecipe('missing', [])).resolves.toBeNull()
  })
})

describe('ProductRepository.addRecipeItem (RQ-CAT-11)', () => {
  it('agrega el ítem al final preservando los previos', async () => {
    const { model, repository } = makeRepository()
    const existing = buildRecipeItem({ ingredientId: 'ing-pan' })
    const doc = buildDoc({ recipe: [existing] })
    model.findById.mockReturnValue(chainable(doc))

    await repository.addRecipeItem('p1', { ingredientId: 'ing-carne', quantity: 2 })

    expect(doc.recipe).toHaveLength(2)
    expect(doc.recipe[0]).toBe(existing)
    expect(doc.recipe[1]).toEqual({ ingredientId: 'ing-carne', quantity: 2, optionAdjustments: [] })
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(
      repository.addRecipeItem('missing', { ingredientId: 'i1', quantity: 1 }),
    ).resolves.toBeNull()
  })
})

describe('ProductRepository.updateRecipeItem (RQ-CAT-11/12)', () => {
  it('reemplaza ingrediente, cantidad y ajustes del ítem', async () => {
    const { model, repository } = makeRepository()
    const item = buildRecipeItem()
    const doc = buildDoc({ recipe: [item] })
    model.findById.mockReturnValue(chainable(doc))

    const patch = {
      ingredientId: 'ing-nuevo',
      quantity: 7,
      optionAdjustments: [{ optionId: 'opt9', quantity: 4 }],
    }
    const result = await repository.updateRecipeItem('p1', 'r1', patch)

    expect(result).toBe(doc)
    expect(item).toEqual(expect.objectContaining(patch))
    expect(item._id?.toString()).toBe('r1')
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('normaliza optionAdjustments ausente a lista vacía', async () => {
    const { model, repository } = makeRepository()
    const item = buildRecipeItem()
    const doc = buildDoc({ recipe: [item] })
    model.findById.mockReturnValue(chainable(doc))

    await repository.updateRecipeItem('p1', 'r1', { ingredientId: 'i2', quantity: 1 })

    expect(item.optionAdjustments).toEqual([])
  })

  const notFoundCases: Array<{ name: string; itemId: string; missingProduct?: boolean }> = [
    { name: 'el ítem no existe', itemId: 'missing' },
    { name: 'el producto no existe', itemId: 'r1', missingProduct: true },
  ]

  it.each(notFoundCases)(
    'devuelve null y no guarda cuando $name',
    async ({ itemId, missingProduct }) => {
      const { model, repository } = makeRepository()
      const doc = buildDoc()
      model.findById.mockReturnValue(chainable(missingProduct ? null : doc))

      await expect(
        repository.updateRecipeItem('p1', itemId, { ingredientId: 'i1', quantity: 1 }),
      ).resolves.toBeNull()
      expect(doc.save).not.toHaveBeenCalled()
    },
  )
})

describe('ProductRepository.removeRecipeItem (RQ-CAT-11)', () => {
  it('quita el ítem indicado y devuelve el producto', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({
      recipe: [buildRecipeItem({ _id: objectId('r1') }), buildRecipeItem({ _id: objectId('r2') })],
    })
    model.findById.mockReturnValue(chainable(doc))

    const result = await repository.removeRecipeItem('p1', 'r1')

    expect(result).toBe(doc)
    expect(doc.recipe).toHaveLength(1)
    expect(doc.recipe[0]._id?.toString()).toBe('r2')
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  // KNOWN BUG: a diferencia de removeConfigGroup/removeConfigOption, removeRecipeItem no
  // compara longitudes antes de guardar. Un itemId inexistente NO devuelve null: guarda y
  // resuelve el producto. El controller sólo lanza RECIPE_ITEM_NOT_FOUND cuando el resultado
  // es falsy, por lo que un DELETE a un ítem inexistente responde 200 en lugar de 404.
  it('KNOWN BUG: devuelve el producto (no null) al quitar un ítem inexistente', async () => {
    const { model, repository } = makeRepository()
    const doc = buildDoc({ recipe: [buildRecipeItem({ _id: objectId('r1') })] })
    model.findById.mockReturnValue(chainable(doc))

    const result = await repository.removeRecipeItem('p1', 'missing')

    expect(result).toBe(doc)
    expect(doc.recipe).toHaveLength(1)
    expect(doc.save).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si el producto no existe', async () => {
    const { model, repository } = makeRepository()
    model.findById.mockReturnValue(chainable(null))

    await expect(repository.removeRecipeItem('missing', 'r1')).resolves.toBeNull()
  })
})
