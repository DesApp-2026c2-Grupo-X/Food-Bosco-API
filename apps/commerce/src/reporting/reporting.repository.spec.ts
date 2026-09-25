import type { Model } from 'mongoose'
import type { BranchStockDocument } from '../stock/branch-stock.model'
import type { CategoryDocument } from '../category/category.model'
import type { OrderDocument } from '../order/order.model'
import type { ProductDocument } from '../product/product.model'
import { ReportingRepository } from './reporting.repository'

const sortableQuery = <T>(result: T): { sort: jest.Mock; exec: jest.Mock } => {
  const exec = jest.fn().mockResolvedValue(result)
  const sort = jest.fn().mockReturnValue({ exec })
  return { sort, exec }
}

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const order = (items: Array<{ productId: string; quantity: number; subtotal: number }>) => ({
  items,
})

const makeRepository = () => {
  const orderModel = { find: jest.fn() }
  const productModel = { find: jest.fn() }
  const categoryModel = { find: jest.fn() }
  const stockModel = { find: jest.fn() }
  const repository = new ReportingRepository(
    orderModel as unknown as Model<OrderDocument>,
    productModel as unknown as Model<ProductDocument>,
    categoryModel as unknown as Model<CategoryDocument>,
    stockModel as unknown as Model<BranchStockDocument>,
  )
  return { repository, orderModel, productModel, categoryModel, stockModel }
}

describe('ReportingRepository.aggregateSales (RQ-REP-01/02/04/05)', () => {
  it('acumula cantidad y facturación (subtotal) por producto', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.find.mockReturnValue(
      execQuery([
        order([
          { productId: 'p1', quantity: 2, subtotal: 200 },
          { productId: 'p2', quantity: 1, subtotal: 50 },
        ]),
      ]),
    )

    const result = await repository.aggregateSales()

    expect(Array.from(result.entries())).toEqual([
      ['p1', { quantity: 2, revenue: 200 }],
      ['p2', { quantity: 1, revenue: 50 }],
    ])
  })

  it('acumula ventas del mismo producto repartidas en varios pedidos', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.find.mockReturnValue(
      execQuery([
        order([{ productId: 'p1', quantity: 2, subtotal: 200 }]),
        order([
          { productId: 'p1', quantity: 3, subtotal: 300 },
          { productId: 'p1', quantity: 1, subtotal: 90 },
        ]),
      ]),
    )

    const result = await repository.aggregateSales()

    expect(result.get('p1')).toEqual({ quantity: 6, revenue: 590 })
  })

  it('devuelve un mapa vacío cuando no hay pedidos', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.find.mockReturnValue(execQuery([]))

    const result = await repository.aggregateSales()

    expect(result.size).toBe(0)
  })

  it('ignora pedidos sin ítems', async () => {
    const { repository, orderModel } = makeRepository()
    orderModel.find.mockReturnValue(execQuery([order([])]))

    const result = await repository.aggregateSales()

    expect(result.size).toBe(0)
  })

  const filterCases: Array<{ name: string; branchId?: string; expected: object }> = [
    { name: 'sin sucursal', branchId: undefined, expected: {} },
    { name: 'con sucursal', branchId: 'b1', expected: { branchId: 'b1' } },
  ]

  it.each(filterCases)('$name filtra los pedidos con $expected', async ({ branchId, expected }) => {
    const { repository, orderModel } = makeRepository()
    orderModel.find.mockReturnValue(execQuery([]))

    await repository.aggregateSales(branchId)

    expect(orderModel.find).toHaveBeenCalledWith(expected)
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
