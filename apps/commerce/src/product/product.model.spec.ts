import type { Types } from 'mongoose'
import { CONFIG_GROUP_TYPE } from '../config/constants'
import type { ConfigGroup, ConfigOption, ProductDocument, RecipeItem } from './product.model'
import { serializeGroup, serializeOption, serializeProduct } from './product.model'

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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    __v: 0,
    ...overrides,
  }) as unknown as ProductDocument

describe('serializeOption (RQ-CAT-07/08)', () => {
  it.each([
    {
      name: 'opción disponible estándar',
      overrides: {},
      expected: { id: 'opt1', name: 'Queso', extraPrice: 10, available: true },
    },
    {
      name: 'opción no disponible',
      overrides: { available: false },
      expected: { id: 'opt1', name: 'Queso', extraPrice: 10, available: false },
    },
    {
      name: 'opción con precio extra 0 (límite)',
      overrides: { extraPrice: 0 },
      expected: { id: 'opt1', name: 'Queso', extraPrice: 0, available: true },
    },
    {
      name: 'opción con precio extra negativo',
      overrides: { extraPrice: -5 },
      expected: { id: 'opt1', name: 'Queso', extraPrice: -5, available: true },
    },
  ])('mapea el contrato público ($name)', ({ overrides, expected }) => {
    const result = serializeOption(buildOption(overrides))

    expect(result).toEqual(expected)
    expect(Object.keys(result).sort()).toEqual(['available', 'extraPrice', 'id', 'name'])
  })

  it('convierte el _id a string', () => {
    const result = serializeOption(buildOption({ _id: objectId('opt-9') }))

    expect(result.id).toBe('opt-9')
    expect(typeof result.id).toBe('string')
  })

  // KNOWN BUG: si un subdocumento no tiene `_id` se serializa `id: ''` en lugar de
  // fallar o exponer un identificador estable. Mongoose normalmente asigna el _id,
  // por eso el caso no se dispara en producción, pero el contrato público queda roto.
  it('KNOWN BUG: sin _id devuelve id vacío en lugar de un identificador válido', () => {
    const result = serializeOption(buildOption({ _id: undefined }))

    expect(result.id).toBe('')
  })
})

describe('serializeGroup (RQ-CAT-06/07)', () => {
  it.each([
    {
      name: 'grupo opcional múltiple',
      overrides: {},
      expected: {
        id: 'g1',
        name: 'Adicionales',
        type: CONFIG_GROUP_TYPE.multiple,
        required: false,
        min: 0,
        max: 2,
        options: [{ id: 'opt1', name: 'Queso', extraPrice: 10, available: true }],
      },
    },
    {
      name: 'grupo obligatorio único',
      overrides: { type: CONFIG_GROUP_TYPE.single, required: true, min: 1, max: 1 },
      expected: {
        id: 'g1',
        name: 'Adicionales',
        type: CONFIG_GROUP_TYPE.single,
        required: true,
        min: 1,
        max: 1,
        options: [{ id: 'opt1', name: 'Queso', extraPrice: 10, available: true }],
      },
    },
  ])('mapea el contrato público ($name)', ({ overrides, expected }) => {
    const result = serializeGroup(buildGroup(overrides))

    expect(result).toEqual(expected)
    expect(Object.keys(result).sort()).toEqual([
      'id',
      'max',
      'min',
      'name',
      'options',
      'required',
      'type',
    ])
  })

  it.each([
    {
      name: 'min y max en null',
      overrides: { min: null, max: null },
      expected: { min: null, max: null },
    },
    {
      name: 'min y max indefinidos se normalizan a null',
      overrides: { min: undefined, max: undefined },
      expected: { min: null, max: null },
    },
    {
      name: 'min 0 conserva el cero',
      overrides: { min: 0, max: undefined },
      expected: { min: 0, max: null },
    },
  ])('normaliza min/max ($name)', ({ overrides, expected }) => {
    const result = serializeGroup(buildGroup(overrides))

    expect(result.min).toBe(expected.min)
    expect(result.max).toBe(expected.max)
  })

  it('mapea todas las opciones preservando el orden', () => {
    const options = [
      buildOption({ _id: objectId('o1'), name: 'Sin cebolla' }),
      buildOption({ _id: objectId('o2'), name: 'Doble queso' }),
      buildOption({ _id: objectId('o3'), name: 'Bacon' }),
    ]

    const result = serializeGroup(buildGroup({ options }))

    expect(result.options.map((option) => option.id)).toEqual(['o1', 'o2', 'o3'])
    expect(result.options.map((option) => option.name)).toEqual([
      'Sin cebolla',
      'Doble queso',
      'Bacon',
    ])
  })

  it('no expone los _id internos del grupo ni de sus opciones', () => {
    const result = serializeGroup(buildGroup())

    expect(result).not.toHaveProperty('_id')
    expect(result.options[0]).not.toHaveProperty('_id')
  })
})

describe('serializeProduct (RQ-CAT-04/06/11/12)', () => {
  it.each([
    {
      name: 'producto completo',
      overrides: {},
      expected: { id: 'p1', image: null, available: true },
    },
    {
      name: 'producto no disponible',
      overrides: { available: false },
      expected: { id: 'p1', image: null, available: false },
    },
    {
      name: 'producto con imagen',
      overrides: { image: 'https://cdn.test/burger.png' },
      expected: { id: 'p1', image: 'https://cdn.test/burger.png', available: true },
    },
    {
      name: 'producto con precio 0',
      overrides: { price: 0 },
      expected: { id: 'p1', image: null, available: true },
    },
  ])('mapea campos básicos ($name)', ({ overrides, expected }) => {
    const result = serializeProduct(buildDoc(overrides))

    expect(result.id).toBe(expected.id)
    expect(typeof result.id).toBe('string')
    expect(result.image).toBe(expected.image)
    expect(result.available).toBe(expected.available)
  })

  it('expone exactamente el contrato público y no filtra campos internos', () => {
    const result = serializeProduct(buildDoc())

    expect(Object.keys(result).sort()).toEqual([
      'available',
      'categoryId',
      'configGroups',
      'description',
      'id',
      'image',
      'name',
      'price',
      'recipe',
    ])
    expect(result).not.toHaveProperty('_id')
    expect(result).not.toHaveProperty('__v')
    expect(result).not.toHaveProperty('createdAt')
    expect(result).not.toHaveProperty('updatedAt')
    expect(result).not.toHaveProperty('save')
  })

  it('normaliza image undefined a null', () => {
    const result = serializeProduct(buildDoc({ image: undefined }))

    expect(result.image).toBeNull()
  })

  it.each([
    {
      name: 'sin grupos ni receta',
      configGroups: [],
      recipe: [],
      expectedGroups: 0,
      expectedRecipe: 0,
    },
    {
      name: 'un grupo y un ítem',
      configGroups: [buildGroup()],
      recipe: [buildRecipeItem()],
      expectedGroups: 1,
      expectedRecipe: 1,
    },
    {
      name: 'varios grupos y varios ítems',
      configGroups: [buildGroup(), buildGroup({ _id: objectId('g2') })],
      recipe: [buildRecipeItem(), buildRecipeItem({ _id: objectId('r2') })],
      expectedGroups: 2,
      expectedRecipe: 2,
    },
  ])('mapea colecciones ($name)', ({ configGroups, recipe, expectedGroups, expectedRecipe }) => {
    const result = serializeProduct(buildDoc({ configGroups, recipe }))

    expect(result.configGroups).toHaveLength(expectedGroups)
    expect(result.recipe).toHaveLength(expectedRecipe)
  })

  it('mapea la receta con ingrediente, cantidad y ajustes por opción', () => {
    const recipe = [
      buildRecipeItem({
        _id: objectId('r1'),
        ingredientId: 'ing-medallon',
        quantity: 1,
        optionAdjustments: [
          { optionId: 'opt-doble', quantity: 2 },
          { optionId: 'opt-triple', quantity: 3 },
        ],
      }),
      buildRecipeItem({
        _id: objectId('r2'),
        ingredientId: 'ing-pan',
        quantity: 1,
        optionAdjustments: [],
      }),
    ]

    const result = serializeProduct(buildDoc({ recipe }))

    expect(result.recipe).toEqual([
      {
        id: 'r1',
        ingredientId: 'ing-medallon',
        quantity: 1,
        optionAdjustments: [
          { optionId: 'opt-doble', quantity: 2 },
          { optionId: 'opt-triple', quantity: 3 },
        ],
      },
      { id: 'r2', ingredientId: 'ing-pan', quantity: 1, optionAdjustments: [] },
    ])
    expect(result.recipe[0]).not.toHaveProperty('_id')
    expect(result.recipe[0].optionAdjustments[0]).not.toHaveProperty('_id')
  })

  it('no comparte referencias con la receta original al proyectar los ajustes', () => {
    const doc = buildDoc()
    const result = serializeProduct(doc)

    expect(result.recipe[0].optionAdjustments[0]).not.toBe(doc.recipe[0].optionAdjustments[0])
    expect(result.recipe[0].optionAdjustments[0]).toEqual({
      optionId: 'opt1',
      quantity: 3,
    })
  })
})
