import type { Model } from 'mongoose'
import { STOCK_MOVEMENT_REASON } from '../config/constants'
import type { BranchStockDocument } from './branch-stock.model'
import type { StockMovementDocument } from './stock-movement.model'
import { StockRepository } from './stock.repository'

const sortableQuery = <T>(result: T): { sort: jest.Mock; exec: jest.Mock } => {
  const exec = jest.fn().mockResolvedValue(result)
  const sort = jest.fn().mockReturnValue({ exec })
  return { sort, exec }
}

const execQuery = <T>(result: T): { exec: jest.Mock } => ({
  exec: jest.fn().mockResolvedValue(result),
})

const makeRepository = () => {
  const stockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }
  const movementModel = { create: jest.fn() }
  const repository = new StockRepository(
    stockModel as unknown as Model<BranchStockDocument>,
    movementModel as unknown as Model<StockMovementDocument>,
  )
  return { repository, stockModel, movementModel }
}

describe('StockRepository.list (RQ-STK-01/02/03)', () => {
  it('filtra por sucursal y ordena por ingrediente', async () => {
    const { repository, stockModel } = makeRepository()
    const docs = [{ ingredientId: 'i1', branchId: 'b1', quantity: 3 }]
    const query = sortableQuery(docs)
    stockModel.find.mockReturnValue(query)

    const result = await repository.list('b1')

    expect(stockModel.find).toHaveBeenCalledWith({ branchId: 'b1' })
    expect(query.sort).toHaveBeenCalledWith({ ingredientId: 1 })
    expect(result).toBe(docs)
  })

  it('sin sucursal lista todas (filtro vacío)', async () => {
    const { repository, stockModel } = makeRepository()
    stockModel.find.mockReturnValue(sortableQuery([]))

    await repository.list()

    expect(stockModel.find).toHaveBeenCalledWith({})
  })

  it('devuelve arreglo vacío cuando no hay documentos', async () => {
    const { repository, stockModel } = makeRepository()
    stockModel.find.mockReturnValue(sortableQuery([]))

    await expect(repository.list('b1')).resolves.toEqual([])
  })
})

describe('StockRepository.findOne (RQ-STK-01)', () => {
  it('busca por sucursal e ingrediente', async () => {
    const { repository, stockModel } = makeRepository()
    const doc = { ingredientId: 'i1', branchId: 'b1', quantity: 3 }
    stockModel.findOne.mockReturnValue(execQuery(doc))

    const result = await repository.findOne('b1', 'i1')

    expect(stockModel.findOne).toHaveBeenCalledWith({ branchId: 'b1', ingredientId: 'i1' })
    expect(result).toBe(doc)
  })

  it('devuelve null cuando el ingrediente no tiene stock', async () => {
    const { repository, stockModel } = makeRepository()
    stockModel.findOne.mockReturnValue(execQuery(null))

    await expect(repository.findOne('b1', 'i1')).resolves.toBeNull()
  })
})

describe('StockRepository.setQuantity (RQ-STK-04)', () => {
  it('hace upsert del stock con la cantidad indicada', async () => {
    const { repository, stockModel } = makeRepository()
    const doc = { ingredientId: 'i1', branchId: 'b1', quantity: 7 }
    stockModel.findOneAndUpdate.mockReturnValue(execQuery(doc))

    const result = await repository.setQuantity('b1', 'i1', 7)

    expect(stockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { branchId: 'b1', ingredientId: 'i1' },
      { $set: { quantity: 7 } },
      { new: true, upsert: true },
    )
    expect(result).toBe(doc)
  })

  it('devuelve null si el driver no devuelve documento', async () => {
    const { repository, stockModel } = makeRepository()
    stockModel.findOneAndUpdate.mockReturnValue(execQuery(null))

    await expect(repository.setQuantity('b1', 'i1', 0)).resolves.toBeNull()
  })
})

const movementData = {
  branchId: 'b1',
  ingredientId: 'i1',
  delta: -3,
  reason: STOCK_MOVEMENT_REASON.preparing,
} as const

describe('StockRepository.createMovement (RQ-STK-04/08)', () => {
  it('crea el movimiento normalizando orderId a null cuando falta', async () => {
    const { repository, movementModel } = makeRepository()
    const doc = { ingredientId: 'i1', delta: -3 }
    movementModel.create.mockResolvedValue(doc)

    const result = await repository.createMovement(movementData)

    expect(movementModel.create).toHaveBeenCalledWith({ ...movementData, orderId: null })
    expect(result).toBe(doc)
  })

  it('persiste el orderId cuando viene informado', async () => {
    const { repository, movementModel } = makeRepository()
    movementModel.create.mockResolvedValue({})

    await repository.createMovement({ ...movementData, orderId: 'o1' })

    expect(movementModel.create).toHaveBeenCalledWith({ ...movementData, orderId: 'o1' })
  })

  it('acepta el motivo "adjust"', async () => {
    const { repository, movementModel } = makeRepository()
    movementModel.create.mockResolvedValue({})

    await repository.createMovement({ ...movementData, reason: STOCK_MOVEMENT_REASON.adjust })

    expect(movementModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: STOCK_MOVEMENT_REASON.adjust }),
    )
  })
})
