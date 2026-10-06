import type { Model } from 'mongoose'
import type { BranchDocument } from '../branch/branch.model'
import type { BranchStockDocument } from '../stock/branch-stock.model'
import type { CategoryDocument } from '../category/category.model'
import type { OrderDocument } from '../order/order.model'
import type { ProductDocument } from '../product/product.model'
import type { OverviewAggregateRaw } from './reporting.repository'
import { ReportingRepository } from './reporting.repository'

const sortableQuery = <T>(result: T): { sort: jest.Mock; exec: jest.Mock } => {
  const exec = jest.fn().mockResolvedValue(result)
  const sort = jest.fn().mockReturnValue({ exec })
  return { sort, exec }
}

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const selectQuery = <T>(result: T): { select: jest.Mock; exec: jest.Mock } => {
  const exec = jest.fn().mockResolvedValue(result)
  const select = jest.fn().mockReturnValue({ exec })
  return { select, exec }
}

const makeRepository = () => {
  const orderModel = { find: jest.fn(), aggregate: jest.fn() }
  const productModel = { find: jest.fn() }
  const categoryModel = { find: jest.fn() }
  const stockModel = { find: jest.fn() }
  const branchModel = { find: jest.fn() }
  const repository = new ReportingRepository(
    orderModel as unknown as Model<OrderDocument>,
    productModel as unknown as Model<ProductDocument>,
    categoryModel as unknown as Model<CategoryDocument>,
    stockModel as unknown as Model<BranchStockDocument>,
    branchModel as unknown as Model<BranchDocument>,
  )
  return { repository, orderModel, productModel, categoryModel, stockModel, branchModel }
}

const emptyRaw = (): OverviewAggregateRaw => ({
  sales: [],
  status: [],
  series: [],
  topProducts: [],
  branchPerformance: [],
})

describe('ReportingRepository.aggregateSales (RQ-REP-01/02/04/05)', () => {
  it('acumula cantidad y facturación por producto a partir de la agregación', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(
      execQuery([
        { _id: 'p1', quantity: 2, revenue: 200 },
        { _id: 'p2', quantity: 1, revenue: 50 },
      ]),
    )

    const result = await repository.aggregateSales()

    expect(Array.from(result.entries())).toEqual([
      ['p1', { quantity: 2, revenue: 200 }],
      ['p2', { quantity: 1, revenue: 50 }],
    ])
  })

  it('devuelve un mapa vacío cuando no hay ventas', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))

    const result = await repository.aggregateSales()

    expect(result.size).toBe(0)
  })

  const filterCases: Array<{ name: string; filter: object; expected: object }> = [
    { name: 'sin sucursal', filter: {}, expected: {} },
    { name: 'con sucursal', filter: { branchId: 'b1' }, expected: { branchId: 'b1' } },
  ]

  it.each(filterCases)('$name inicia el pipeline con $expected', async ({ filter, expected }) => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))

    await repository.aggregateSales(filter)

    const pipeline = orderModel.aggregate.mock.calls[0][0]
    expect(pipeline[0]).toEqual({ $match: expected })
  })

  it('excluye pedidos cancelados por defecto', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))

    await repository.aggregateSales()

    const pipeline = orderModel.aggregate.mock.calls[0][0]
    expect(pipeline[1]).toEqual({ $match: { status: { $ne: 'cancelled' } } })
  })

  it('respeta el filtro de estado cuando se indica uno', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))

    await repository.aggregateSales({ status: 'delivered' })

    const pipeline = orderModel.aggregate.mock.calls[0][0]
    expect(pipeline[1]).toEqual({ $match: { status: 'delivered' } })
  })

  it('aplica el rango de fechas al match de createdAt', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))
    const from = new Date('2026-01-01T00:00:00.000Z')
    const to = new Date('2026-01-31T23:59:59.999Z')

    await repository.aggregateSales({ from, to })

    const pipeline = orderModel.aggregate.mock.calls[0][0]
    expect(pipeline[0]).toEqual({ $match: { createdAt: { $gte: from, $lte: to } } })
  })

  it('sin resultados de categoría no consulta ventas', async () => {
    const { repository, orderModel, productModel } = makeRepository()
    productModel.find.mockReturnValue(selectQuery([]))

    const result = await repository.aggregateSales({ categoryId: 'cat1' })

    expect(result.size).toBe(0)
    expect(orderModel.aggregate).not.toHaveBeenCalled()
  })

  it('filtra por los productos de la categoría cuando existe', async () => {
    const { repository, orderModel, productModel } = makeRepository()
    productModel.find.mockReturnValue(
      selectQuery([{ _id: { toString: () => 'p1' } }, { _id: { toString: () => 'p2' } }]),
    )
    orderModel.aggregate.mockReturnValue(execQuery([]))

    await repository.aggregateSales({ categoryId: 'cat1' })

    const pipeline = orderModel.aggregate.mock.calls[0][0]
    const itemMatches = pipeline.filter(
      (stage: Record<string, unknown>) =>
        stage.$match !== undefined &&
        (stage.$match as Record<string, unknown>)['items.productId'] !== undefined,
    )
    expect(itemMatches).toHaveLength(2)
    expect(itemMatches[0]).toEqual({ $match: { 'items.productId': { $in: ['p1', 'p2'] } } })
  })
})

describe('ReportingRepository.aggregateOverview (RQ-REP-07/08)', () => {
  it('devuelve el facet con ventas, estados, series, ranking y sucursales', async () => {
    const { repository, orderModel } = makeRepository()
    const raw: OverviewAggregateRaw = {
      sales: [{ revenue: 1000, orders: 5 }],
      status: [{ _id: 'delivered', count: 4 }],
      series: [{ _id: '2026-01-01', revenue: 1000, orders: 5 }],
      topProducts: [{ _id: 'p1', name: 'Producto 1', quantity: 3, revenue: 300 }],
      branchPerformance: [{ _id: 'b1', revenue: 1000, orders: 5 }],
    }
    orderModel.aggregate.mockReturnValue(execQuery([raw]))

    const result = await repository.aggregateOverview({ branchId: 'b1' })

    expect(result).toEqual(raw)
    const pipeline = orderModel.aggregate.mock.calls[0][0]
    expect(pipeline[0]).toEqual({ $match: { branchId: 'b1' } })
    expect(pipeline[1]).toHaveProperty('$facet')
  })

  it('devuelve estructura vacía si Mongo no devuelve facet', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.aggregate.mockReturnValue(execQuery([]))

    const result = await repository.aggregateOverview({})

    expect(result).toEqual(emptyRaw())
  })
})

describe('ReportingRepository.listBranchNames', () => {
  it('mapea id a nombre de sucursal', async () => {
    const { repository, branchModel } = makeRepository()
    branchModel.find.mockReturnValue(execQuery([{ _id: { toString: () => 'b1' }, name: 'Centro' }]))

    const result = await repository.listBranchNames(['b1'])

    expect(result.get('b1')).toBe('Centro')
  })

  it('sin ids no consulta la base', async () => {
    const { repository, branchModel } = makeRepository()

    const result = await repository.listBranchNames([])

    expect(result.size).toBe(0)
    expect(branchModel.find).not.toHaveBeenCalled()
  })
})

describe('ReportingRepository.listProducts (RQ-REP-05)', () => {
  it('lista productos ordenados por nombre', async () => {
    const { repository, productModel } = makeRepository()
    const docs = [{ name: 'A' }]
    const query = sortableQuery(docs)
    productModel.find.mockReturnValue(query)

    const result = await repository.listProducts()

    expect(productModel.find).toHaveBeenCalledWith()
    expect(query.sort).toHaveBeenCalledWith({ name: 1 })
    expect(result).toBe(docs)
  })
})

describe('ReportingRepository.listCategories (RQ-REP-05)', () => {
  it('lista todas las categorías', async () => {
    const { repository, categoryModel } = makeRepository()
    const docs = [{ name: 'Bebidas' }]
    categoryModel.find.mockReturnValue(execQuery(docs))

    const result = await repository.listCategories()

    expect(categoryModel.find).toHaveBeenCalledWith()
    expect(result).toBe(docs)
  })
})

describe('ReportingRepository.listStock (RQ-REP-03/06)', () => {
  const cases: Array<{ name: string; branchId?: string; expected: object }> = [
    { name: 'todas las sucursales', branchId: undefined, expected: {} },
    { name: 'una sucursal', branchId: 'b1', expected: { branchId: 'b1' } },
  ]

  it.each(cases)('$name → filtro $expected', async ({ branchId, expected }) => {
    const { repository, stockModel } = makeRepository()
    const docs = [{ ingredientId: 'i1', quantity: 0 }]
    stockModel.find.mockReturnValue(execQuery(docs))

    const result = await repository.listStock(branchId)

    expect(stockModel.find).toHaveBeenCalledWith(expected)
    expect(result).toBe(docs)
  })
})
