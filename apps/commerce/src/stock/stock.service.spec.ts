import { ERROR_CODES } from '../config/constants'
import { StockRepository } from './stock.repository'
import { StockService } from './stock.service'

const makeService = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const repository = {
    list: jest.fn(),
    findOne: jest.fn(),
    setQuantity: jest.fn(),
    createMovement: jest.fn(),
    ...overrides,
  }
  return { repository, service: new StockService(repository as unknown as StockRepository) }
}

describe('StockService.validateAvailability (RQ-STK-06)', () => {
  it('acepta cuando hay stock suficiente de todos los ingredientes', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue([
        { ingredientId: 'i1', quantity: 10 },
        { ingredientId: 'i2', quantity: 5 },
      ]),
    })

    await expect(service.validateAvailability('b1', { i1: 3, i2: 5 })).resolves.toBeUndefined()
  })

  it('rechaza cuando un ingrediente no tiene stock suficiente', async () => {
    const { service } = makeService({
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 2 }]),
    })

    await expect(service.validateAvailability('b1', { i1: 3 })).rejects.toMatchObject({
      code: ERROR_CODES.insufficientStock,
    })
  })

  it('rechaza cuando el ingrediente no existe en la sucursal', async () => {
    const { service } = makeService({ list: jest.fn().mockResolvedValue([]) })

    await expect(service.validateAvailability('b1', { i1: 1 })).rejects.toMatchObject({
      code: ERROR_CODES.insufficientStock,
    })
  })
})

describe('StockService.discount (RQ-STK-08)', () => {
  it('descuenta stock y registra movimientos con motivo "preparing"', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 10 }]),
      setQuantity: jest.fn().mockResolvedValue({ ingredientId: 'i1', branchId: 'b1', quantity: 7 }),
    })

    await service.discount('b1', { i1: 3 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 7)
    expect(repository.createMovement).toHaveBeenCalledWith({
      branchId: 'b1',
      ingredientId: 'i1',
      delta: -3,
      reason: 'preparing',
      orderId: 'o1',
    })
  })

  it('no descuenta por debajo de cero', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 2 }]),
      setQuantity: jest.fn(),
    })

    await service.discount('b1', { i1: 5 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
  })
})

describe('StockService.adjust (RQ-STK-04)', () => {
  it('suma el delta y registra un movimiento "adjust"', async () => {
    const { repository, service } = makeService({
      findOne: jest.fn().mockResolvedValue({ quantity: 10 }),
      setQuantity: jest.fn().mockResolvedValue({ ingredientId: 'i1', branchId: 'b1', quantity: 15 }),
    })

    const result = await service.adjust('b1', 'i1', 5)

    expect(result.quantity).toBe(15)
    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 5, reason: 'adjust' }),
    )
  })

  it('ajuste negativo no deja stock negativo', async () => {
    const { repository, service } = makeService({
      findOne: jest.fn().mockResolvedValue({ quantity: 2 }),
      setQuantity: jest.fn().mockResolvedValue({ ingredientId: 'i1', branchId: 'b1', quantity: 0 }),
    })

    await service.adjust('b1', 'i1', -10)

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
  })
})
