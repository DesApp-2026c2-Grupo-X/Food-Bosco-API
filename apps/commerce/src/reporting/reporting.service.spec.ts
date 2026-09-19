import type { CategoryDocument } from '../category/category.model'
import type { ProductDocument } from '../product/product.model'
import type { SalesAggregate } from './reporting.repository'
import { ReportingRepository } from './reporting.repository'
import { ReportingService } from './reporting.service'

const productDoc = (id: string, overrides: Partial<Record<string, unknown>> = {}): ProductDocument =>
  ({
    _id: { toString: () => id },
    categoryId: 'cat1',
    name: `Producto ${id}`,
    description: 'desc',
    price: 10,
    image: null,
    available: true,
    configGroups: [],
    recipe: [],
    ...overrides,
  }) as unknown as ProductDocument

const categoryDoc = (
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): CategoryDocument =>
  ({
    _id: { toString: () => id },
    name: `Categoria ${id}`,
    active: true,
    ...overrides,
  }) as unknown as CategoryDocument

const salesMap = (entries: Array<[string, number, number]>): Map<string, SalesAggregate> =>
  new Map(entries.map(([productId, quantity, revenue]) => [productId, { quantity, revenue }]))

const makeService = (
  data: {
    products?: ProductDocument[]
    categories?: CategoryDocument[]
    sales?: Map<string, SalesAggregate>
    stock?: Array<{ ingredientId: string; quantity: number }>
  } = {},
) => {
  const repository = {
    listProducts: jest.fn().mockResolvedValue(data.products ?? []),
    listCategories: jest.fn().mockResolvedValue(data.categories ?? []),
    aggregateSales: jest.fn().mockResolvedValue(data.sales ?? new Map()),
    listStock: jest.fn().mockResolvedValue(data.stock ?? []),
  }
  return { repository, service: new ReportingService(repository as unknown as ReportingRepository) }
}

const ids = (rows: Array<{ product: { id: string } }>): string[] => rows.map((row) => row.product.id)
const positions = (rows: Array<{ position: number }>): number[] => rows.map((row) => row.position)

describe('ReportingService.bestSellers (RQ-REP-01)', () => {
  const cases: Array<{
    name: string
    products: ProductDocument[]
    sales: Map<string, SalesAggregate>
    expected: string[]
  }> = [
    {
      name: 'ordena por cantidad de mayor a menor',
      products: [productDoc('p1'), productDoc('p2'), productDoc('p3')],
      sales: salesMap([
        ['p1', 5, 500],
        ['p2', 3, 300],
        ['p3', 8, 800],
      ]),
      expected: ['p3', 'p1', 'p2'],
    },
    {
      name: 'ante empate conserva el orden del catálogo',
      products: [productDoc('p1'), productDoc('p2')],
      sales: salesMap([
        ['p1', 2, 20],
        ['p2', 2, 40],
      ]),
      expected: ['p1', 'p2'],
    },
    {
      name: 'excluye productos sin ventas',
      products: [productDoc('p1'), productDoc('p2')],
      sales: salesMap([['p1', 4, 400]]),
      expected: ['p1'],
    },
    {
      name: 'sin ventas devuelve lista vacía',
      products: [productDoc('p1')],
      sales: salesMap([]),
      expected: [],
    },
  ]

  it.each(cases)('$name → $expected', async ({ products, sales, expected }) => {
    const { service } = makeService({ products, sales })

    const rows = await service.bestSellers('b1')

    expect(ids(rows)).toEqual(expected)
    expect(positions(rows)).toEqual(expected.map((_id, index) => index + 1))
    expect(rows.every((row) => row.revenue === null)).toBe(true)
  })

  it('mapea producto, categoría y propaga la sucursal al repositorio', async () => {
    const { repository, service } = makeService({
      products: [productDoc('p1', { categoryId: 'cat1' })],
      categories: [categoryDoc('cat1')],
      sales: salesMap([['p1', 4, 400]]),
    })

    const rows = await service.bestSellers('b1')

    expect(repository.aggregateSales).toHaveBeenCalledWith('b1')
    expect(rows[0]).toMatchObject({
      position: 1,
      quantity: 4,
      revenue: null,
      product: { id: 'p1', name: 'Producto p1' },
      category: { id: 'cat1', name: 'Categoria cat1' },
    })
  })

  it('usa category null cuando el producto no tiene categoría en el catálogo', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { categoryId: 'missing' })],
      categories: [categoryDoc('cat1')],
      sales: salesMap([['p1', 1, 10]]),
    })

    const rows = await service.bestSellers()

    expect(rows[0].category).toBeNull()
  })
})

describe('ReportingService.leastSold (RQ-REP-02)', () => {
  const cases: Array<{
    name: string
    products: ProductDocument[]
    sales: Map<string, SalesAggregate>
    expected: string[]
  }> = [
    {
      name: 'incluye productos con 0 ventas y ordena de menor a mayor',
      products: [productDoc('p1'), productDoc('p2'), productDoc('p3')],
      sales: salesMap([
        ['p1', 5, 500],
        ['p2', 2, 200],
      ]),
      expected: ['p3', 'p2', 'p1'],
    },
    {
      name: 'sin ventas lista todos con cantidad 0 conservando el orden',
      products: [productDoc('p1'), productDoc('p2')],
      sales: salesMap([]),
      expected: ['p1', 'p2'],
    },
    {
      name: 'catálogo vacío devuelve lista vacía',
      products: [],
      sales: salesMap([['p1', 1, 10]]),
      expected: [],
    },
  ]

  it.each(cases)('$name → $expected', async ({ products, sales, expected }) => {
    const { service } = makeService({ products, sales })

    const rows = await service.leastSold('b1')

    expect(ids(rows)).toEqual(expected)
    expect(positions(rows)).toEqual(expected.map((_id, index) => index + 1))
  })

  it('asigna cantidad y anula revenue', async () => {
    const { service } = makeService({
      products: [productDoc('p1')],
      sales: salesMap([['p1', 6, 600]]),
    })

    const rows = await service.leastSold()

    expect(rows[0]).toMatchObject({ position: 1, quantity: 6, revenue: null })
  })
})

describe('ReportingService.highestRevenue (RQ-REP-04)', () => {
  const cases: Array<{
    name: string
    products: ProductDocument[]
    sales: Map<string, SalesAggregate>
    expected: string[]
  }> = [
    {
      name: 'ordena por facturación de mayor a menor',
      products: [productDoc('p1'), productDoc('p2'), productDoc('p3')],
      sales: salesMap([
        ['p1', 1, 100],
        ['p2', 1, 50],
        ['p3', 1, 200],
      ]),
      expected: ['p3', 'p1', 'p2'],
    },
    {
      name: 'ante empate conserva el orden del catálogo',
      products: [productDoc('p1'), productDoc('p2')],
      sales: salesMap([
        ['p1', 1, 100],
        ['p2', 5, 100],
      ]),
      expected: ['p1', 'p2'],
    },
    {
      name: 'excluye productos sin facturación',
      products: [productDoc('p1'), productDoc('p2')],
      sales: salesMap([
        ['p1', 3, 0],
        ['p2', 1, 80],
      ]),
      expected: ['p2'],
    },
    {
      name: 'sin facturación devuelve lista vacía',
      products: [productDoc('p1')],
      sales: salesMap([]),
      expected: [],
    },
  ]

  it.each(cases)('$name → $expected', async ({ products, sales, expected }) => {
    const { service } = makeService({ products, sales })

    const rows = await service.highestRevenue('b1')

    expect(ids(rows)).toEqual(expected)
    expect(positions(rows)).toEqual(expected.map((_id, index) => index + 1))
    expect(rows.every((row) => row.quantity === null)).toBe(true)
  })

  it('expone revenue y mapea la categoría', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { categoryId: 'cat1' })],
      categories: [categoryDoc('cat1')],
      sales: salesMap([['p1', 2, 250]]),
    })

    const rows = await service.highestRevenue()

    expect(rows[0]).toMatchObject({
      position: 1,
      quantity: null,
      revenue: 250,
      category: { id: 'cat1' },
    })
  })
})

describe('ReportingService.outOfStock (RQ-REP-03/06)', () => {
  const recipe = (ingredientId: string, quantity: number) => ({
    ingredientId,
    quantity,
    optionAdjustments: [],
  })

  it('incluye productos cuyo ingrediente está en 0', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [recipe('i1', 1)] })],
      stock: [{ ingredientId: 'i1', quantity: 0 }],
    })

    const rows = await service.outOfStock('b1')

    expect(ids(rows)).toEqual(['p1'])
    expect(rows[0].quantity).toBe(0)
  })

  it('incluye productos cuando falta el ingrediente en el stock (0 implícito)', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [recipe('i9', 1)] })],
      stock: [{ ingredientId: 'i1', quantity: 100 }],
    })

    const rows = await service.outOfStock('b1')

    expect(ids(rows)).toEqual(['p1'])
  })

  it('incluye productos con stock negativo', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [recipe('i1', 1)] })],
      stock: [{ ingredientId: 'i1', quantity: -3 }],
    })

    const rows = await service.outOfStock('b1')

    expect(ids(rows)).toEqual(['p1'])
  })

  it('excluye productos con stock positivo en todos sus ingredientes', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [recipe('i1', 1), recipe('i2', 2)] })],
      stock: [
        { ingredientId: 'i1', quantity: 1 },
        { ingredientId: 'i2', quantity: 5 },
      ],
    })

    await expect(service.outOfStock('b1')).resolves.toEqual([])
  })

  it('con un solo ingrediente faltante alcanza para marcarlo sin stock', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [recipe('i1', 1), recipe('i2', 1)] })],
      stock: [
        { ingredientId: 'i1', quantity: 10 },
        { ingredientId: 'i2', quantity: 0 },
      ],
    })

    const rows = await service.outOfStock('b1')

    expect(ids(rows)).toEqual(['p1'])
  })

  it('ignora productos sin receta', async () => {
    const { service } = makeService({
      products: [productDoc('p1', { recipe: [] })],
      stock: [],
    })

    await expect(service.outOfStock('b1')).resolves.toEqual([])
  })

  it('mapea categoría y propaga la sucursal al listado de stock', async () => {
    const { repository, service } = makeService({
      products: [productDoc('p1', { categoryId: 'cat1', recipe: [recipe('i1', 1)] })],
      categories: [categoryDoc('cat1')],
      stock: [],
    })

    const rows = await service.outOfStock('b1')

    expect(repository.listStock).toHaveBeenCalledWith('b1')
    expect(rows[0].category).toEqual({ id: 'cat1', name: 'Categoria cat1', active: true })
  })

  it('devuelve lista vacía sin productos', async () => {
    const { service } = makeService({ products: [], stock: [] })

    await expect(service.outOfStock()).resolves.toEqual([])
  })
})
