import { ERROR_CODES, STOCK_MOVEMENT_REASON } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { BranchStockDocument } from './branch-stock.model'
import { StockRepository } from './stock.repository'
import { StockService } from './stock.service'

const stockDoc = (
  overrides: Partial<{ ingredientId: string; branchId: string; quantity: number }> = {},
): BranchStockDocument =>
  ({
    ingredientId: 'i1',
    branchId: 'b1',
    quantity: 10,
    ...overrides,
  }) as unknown as BranchStockDocument

const makeService = (overrides: Partial<Record<string, jest.Mock>> = {}) => {
  const repository = {
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    setQuantity: jest.fn().mockResolvedValue(null),
    decrementIfAvailable: jest.fn(),
    increment: jest.fn(),
    createMovement: jest.fn().mockResolvedValue({}),
    ...overrides,
  }
  return { repository, service: new StockService(repository as unknown as StockRepository) }
}

const catchDomainError = async (promise: Promise<unknown>): Promise<DomainException> => {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(DomainException)
    return error as DomainException
  }
  throw new Error('Se esperaba un DomainException')
}

describe('StockService.list (RQ-STK-01/02/03)', () => {
  it('serializa los documentos y respeta la sucursal indicada', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([stockDoc({ ingredientId: 'i1', quantity: 7 })]),
    })

    const result = await service.list('b1')

    expect(repository.list).toHaveBeenCalledWith('b1')
    expect(result).toEqual([{ ingredientId: 'i1', branchId: 'b1', quantity: 7 }])
  })

  it('lista todas las sucursales cuando no se indica branchId', async () => {
    const { repository, service } = makeService()

    await service.list()

    expect(repository.list).toHaveBeenCalledWith(undefined)
  })
})

describe('StockService.validateAvailability (RQ-STK-05/06)', () => {
  const cases: Array<{
    name: string
    requirements: Record<string, number>
    stock: Array<{ ingredientId: string; quantity: number }>
    expected: 'ok' | 'insufficient'
    missingIngredientId?: string
    availableQuantity?: number
  }> = [
    {
      name: 'stock suficiente para todos los ingredientes',
      requirements: { i1: 3, i2: 5 },
      stock: [
        { ingredientId: 'i1', quantity: 10 },
        { ingredientId: 'i2', quantity: 5 },
      ],
      expected: 'ok',
    },
    {
      name: 'cantidad exactamente igual al stock (límite)',
      requirements: { i1: 5 },
      stock: [{ ingredientId: 'i1', quantity: 5 }],
      expected: 'ok',
    },
    {
      name: 'requiere una unidad más que el stock disponible',
      requirements: { i1: 6 },
      stock: [{ ingredientId: 'i1', quantity: 5 }],
      expected: 'insufficient',
      missingIngredientId: 'i1',
      availableQuantity: 5,
    },
    {
      name: 'el ingrediente no existe en la sucursal',
      requirements: { i1: 1 },
      stock: [],
      expected: 'insufficient',
      missingIngredientId: 'i1',
      availableQuantity: 0,
    },
    {
      name: 'múltiples ingredientes donde uno es insuficiente',
      requirements: { i1: 1, i2: 10 },
      stock: [
        { ingredientId: 'i1', quantity: 1 },
        { ingredientId: 'i2', quantity: 5 },
      ],
      expected: 'insufficient',
      missingIngredientId: 'i2',
      availableQuantity: 5,
    },
    {
      name: 'sin requerimientos no exige nada',
      requirements: {},
      stock: [],
      expected: 'ok',
    },
  ]

  it.each(cases)(
    '$name → $expected',
    async ({ requirements, stock, expected, missingIngredientId, availableQuantity }) => {
      const { repository, service } = makeService({ list: jest.fn().mockResolvedValue(stock) })

      if (expected === 'ok') {
        await expect(service.validateAvailability('b1', requirements)).resolves.toBeUndefined()
        expect(repository.decrementIfAvailable).not.toHaveBeenCalled()
        expect(repository.createMovement).not.toHaveBeenCalled()
        return
      }

      const error = await catchDomainError(service.validateAvailability('b1', requirements))

      expect(error.code).toBe(ERROR_CODES.insufficientStock)
      expect(error.getStatus()).toBe(409)
      expect(error.details).toEqual({
        ingredientId: missingIngredientId,
        requestedQuantity: requirements[missingIngredientId!],
        availableQuantity,
      })
      expect(repository.decrementIfAvailable).not.toHaveBeenCalled()
      expect(repository.createMovement).not.toHaveBeenCalled()
    },
  )
})

describe('StockService.discount (RQ-STK-07/08)', () => {
  it('descuenta de forma atómica y registra movimientos "preparing"', async () => {
    const decrementIfAvailable = jest
      .fn()
      .mockResolvedValueOnce(stockDoc({ ingredientId: 'i1', quantity: 7 }))
      .mockResolvedValueOnce(stockDoc({ ingredientId: 'i2', quantity: 3 }))
    const { repository, service } = makeService({ decrementIfAvailable })

    await service.discount('b1', { i1: 3, i2: 2 }, 'o1')

    expect(decrementIfAvailable).toHaveBeenNthCalledWith(1, 'b1', 'i1', 3)
    expect(decrementIfAvailable).toHaveBeenNthCalledWith(2, 'b1', 'i2', 2)
    expect(repository.createMovement).toHaveBeenNthCalledWith(1, {
      branchId: 'b1',
      ingredientId: 'i1',
      delta: -3,
      reason: STOCK_MOVEMENT_REASON.preparing,
      orderId: 'o1',
    })
    expect(repository.createMovement).toHaveBeenNthCalledWith(2, {
      branchId: 'b1',
      ingredientId: 'i2',
      delta: -2,
      reason: STOCK_MOVEMENT_REASON.preparing,
      orderId: 'o1',
    })
  })

  it('descuenta exactamente el stock disponible y deja 0', async () => {
    const { repository, service } = makeService({
      decrementIfAvailable: jest.fn().mockResolvedValue(stockDoc({ quantity: 0 })),
    })

    await service.discount('b1', { i1: 5 }, 'o1')

    expect(repository.decrementIfAvailable).toHaveBeenCalledWith('b1', 'i1', 5)
    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -5, orderId: 'o1' }),
    )
  })

  it('si falta stock, compensa lo descontado y no registra movimientos', async () => {
    const decrementIfAvailable = jest
      .fn()
      .mockResolvedValueOnce(stockDoc({ ingredientId: 'i1', quantity: 7 }))
      .mockResolvedValueOnce(null)
    const { repository, service } = makeService({
      decrementIfAvailable,
      findOne: jest.fn().mockResolvedValue(stockDoc({ ingredientId: 'i2', quantity: 1 })),
      increment: jest.fn().mockResolvedValue(stockDoc({ quantity: 10 })),
    })

    const error = await catchDomainError(service.discount('b1', { i1: 3, i2: 5 }, 'o1'))

    expect(error.code).toBe(ERROR_CODES.insufficientStock)
    expect(error.details).toEqual({
      ingredientId: 'i2',
      requestedQuantity: 5,
      availableQuantity: 1,
    })
    expect(repository.increment).toHaveBeenCalledWith('b1', 'i1', 3)
    expect(repository.createMovement).toHaveBeenCalledTimes(1)
    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: 'i1',
        delta: 3,
        reason: STOCK_MOVEMENT_REASON.adjust,
      }),
    )
  })

  it('no escribe nada si no hay requerimientos', async () => {
    const { repository, service } = makeService()

    await service.discount('b1', {}, 'o1')

    expect(repository.decrementIfAvailable).not.toHaveBeenCalled()
    expect(repository.createMovement).not.toHaveBeenCalled()
  })
})

describe('StockService.restore', () => {
  it('devuelve el stock y registra un movimiento de ajuste por ingrediente', async () => {
    const { repository, service } = makeService({
      increment: jest.fn().mockResolvedValue(stockDoc()),
    })

    await service.restore('b1', { i1: 3, i2: 2 }, 'o1')

    expect(repository.increment).toHaveBeenNthCalledWith(1, 'b1', 'i1', 3)
    expect(repository.increment).toHaveBeenNthCalledWith(2, 'b1', 'i2', 2)
    expect(repository.createMovement).toHaveBeenCalledTimes(2)
    expect(repository.createMovement).toHaveBeenNthCalledWith(1, {
      branchId: 'b1',
      ingredientId: 'i1',
      delta: 3,
      reason: STOCK_MOVEMENT_REASON.adjust,
      orderId: 'o1',
    })
  })
})

describe('StockService.adjust (RQ-STK-04)', () => {
  it.each([
    { name: 'delta positivo', delta: 4, expected: 4 },
    { name: 'delta negativo', delta: -4, expected: 4 },
  ])('$name registra el delta real', async ({ delta, expected }) => {
    const { repository, service } = makeService({
      increment: jest.fn().mockResolvedValue(stockDoc({ quantity: 14 })),
      decrementIfAvailable: jest.fn().mockResolvedValue(stockDoc({ quantity: 6 })),
    })

    const result = await service.adjust('b1', 'i1', delta)

    if (delta > 0) {
      expect(repository.increment).toHaveBeenCalledWith('b1', 'i1', expected)
      expect(repository.decrementIfAvailable).not.toHaveBeenCalled()
      expect(result.quantity).toBe(14)
    } else {
      expect(repository.decrementIfAvailable).toHaveBeenCalledWith('b1', 'i1', expected)
      expect(repository.increment).not.toHaveBeenCalled()
      expect(result.quantity).toBe(6)
    }
    expect(repository.createMovement).toHaveBeenCalledWith({
      branchId: 'b1',
      ingredientId: 'i1',
      delta,
      reason: STOCK_MOVEMENT_REASON.adjust,
      orderId: undefined,
    })
  })

  it('rechaza un ajuste negativo mayor al stock disponible', async () => {
    const { repository, service } = makeService({
      decrementIfAvailable: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(stockDoc({ quantity: 2 })),
    })

    const error = await catchDomainError(service.adjust('b1', 'i1', -10))

    expect(error.code).toBe(ERROR_CODES.insufficientStock)
    expect(error.details).toEqual({
      ingredientId: 'i1',
      requestedQuantity: 10,
      availableQuantity: 2,
    })
    expect(repository.createMovement).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'cero', delta: 0 },
    { name: 'decimal', delta: 1.5 },
  ])('rechaza un ajuste $name con VALIDATION_ERROR', async ({ delta }) => {
    const { repository, service } = makeService()

    const error = await catchDomainError(service.adjust('b1', 'i1', delta))

    expect(error.code).toBe(ERROR_CODES.validationError)
    expect(error.getStatus()).toBe(400)
    expect(repository.increment).not.toHaveBeenCalled()
    expect(repository.decrementIfAvailable).not.toHaveBeenCalled()
  })

  it('registra el motivo recibido y el orderId', async () => {
    const { repository, service } = makeService({
      increment: jest.fn().mockResolvedValue(stockDoc({ quantity: 15 })),
    })

    await service.adjust('b1', 'i1', 5, ' reposicion ', 'o1')

    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ delta: 5, reason: 'reposicion', orderId: 'o1' }),
    )
  })

  it.each([
    { name: 'vacío', reason: '' },
    { name: 'solo espacios', reason: '   ' },
  ])('usa el motivo por defecto cuando el motivo es $name', async ({ reason }) => {
    const { repository, service } = makeService({
      increment: jest.fn().mockResolvedValue(stockDoc()),
    })

    await service.adjust('b1', 'i1', 5, reason)

    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ reason: STOCK_MOVEMENT_REASON.adjust }),
    )
  })
})
