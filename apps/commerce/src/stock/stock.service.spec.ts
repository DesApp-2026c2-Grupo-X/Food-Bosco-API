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

  it('devuelve lista vacía cuando no hay stock', async () => {
    const { service } = makeService({ list: jest.fn().mockResolvedValue([]) })

    await expect(service.list('b1')).resolves.toEqual([])
  })
})

describe('StockService.validateAvailability (RQ-STK-05/06)', () => {
  const cases: Array<{
    name: string
    requirements: Record<string, number>
    stock: Array<{ ingredientId: string; quantity: number }>
    expected: 'ok' | 'insufficient'
    missingIngredientId?: string
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
    },
    {
      name: 'el ingrediente no existe en la sucursal',
      requirements: { i1: 1 },
      stock: [],
      expected: 'insufficient',
      missingIngredientId: 'i1',
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
    async ({ requirements, stock, expected, missingIngredientId }) => {
      const { repository, service } = makeService({ list: jest.fn().mockResolvedValue(stock) })

      if (expected === 'ok') {
        await expect(service.validateAvailability('b1', requirements)).resolves.toBeUndefined()
        expect(repository.setQuantity).not.toHaveBeenCalled()
        expect(repository.createMovement).not.toHaveBeenCalled()
        return
      }

      const error = await catchDomainError(service.validateAvailability('b1', requirements))

      expect(error.code).toBe(ERROR_CODES.insufficientStock)
      expect(error.message).toBe(`Stock insuficiente para el ingrediente ${missingIngredientId}`)
      expect(error.getStatus()).toBe(409)
      expect(repository.setQuantity).not.toHaveBeenCalled()
      expect(repository.createMovement).not.toHaveBeenCalled()
    },
  )
})

describe('StockService.discount (RQ-STK-07/08)', () => {
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
      reason: STOCK_MOVEMENT_REASON.preparing,
      orderId: 'o1',
    })
  })

  it('agrega los requerimientos de varios ingredientes y registra un movimiento por cada uno', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([
        { ingredientId: 'i1', quantity: 10 },
        { ingredientId: 'i2', quantity: 5 },
      ]),
    })

    await service.discount('b1', { i1: 3, i2: 2 }, 'o1')

    expect(repository.setQuantity).toHaveBeenNthCalledWith(1, 'b1', 'i1', 7)
    expect(repository.setQuantity).toHaveBeenNthCalledWith(2, 'b1', 'i2', 3)
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
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 5 }]),
    })

    await service.discount('b1', { i1: 5 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
  })

  it('no descuenta por debajo de cero', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 2 }]),
      setQuantity: jest.fn(),
    })

    await service.discount('b1', { i1: 5 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
  })

  // KNOWN BUG: cuando el requerimiento supera el stock disponible, setQuantity recorta a 0
  // pero el movimiento registra el delta solicitado (-5) en lugar del cambio real (-2).
  // El historial de movimientos no reconcilia con branchStock.
  it('registra el delta solicitado aunque no coincida con el recorte real', async () => {
    const { repository, service } = makeService({
      list: jest.fn().mockResolvedValue([{ ingredientId: 'i1', quantity: 2 }]),
    })

    await service.discount('b1', { i1: 5 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
    expect(repository.createMovement).toHaveBeenCalledWith(expect.objectContaining({ delta: -5 }))
  })

  it('trata un ingrediente ausente como stock 0 y registra el delta negativo', async () => {
    const { repository, service } = makeService({ list: jest.fn().mockResolvedValue([]) })

    await service.discount('b1', { i9: 2 }, 'o1')

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i9', 0)
    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: 'i9',
        delta: -2,
        reason: STOCK_MOVEMENT_REASON.preparing,
        orderId: 'o1',
      }),
    )
  })

  it('no toca el repositorio de escritura si no hay requerimientos', async () => {
    const { repository, service } = makeService()

    await service.discount('b1', {}, 'o1')

    expect(repository.list).toHaveBeenCalledWith('b1')
    expect(repository.setQuantity).not.toHaveBeenCalled()
    expect(repository.createMovement).not.toHaveBeenCalled()
  })
})

describe('StockService.adjust (RQ-STK-04)', () => {
  const cases: Array<{
    name: string
    initial: number | null
    delta: number
    expected: number
  }> = [
    { name: 'delta positivo', initial: 10, delta: 5, expected: 15 },
    { name: 'delta negativo', initial: 10, delta: -4, expected: 6 },
    { name: 'delta negativo que cruza el cero', initial: 2, delta: -10, expected: 0 },
    { name: 'delta negativo desde cero', initial: 0, delta: -3, expected: 0 },
    { name: 'delta sobre stock inexistente', initial: null, delta: 4, expected: 4 },
  ]

  it.each(cases)('$name: $initial + ($delta) → $expected', async ({ initial, delta, expected }) => {
    const setQuantity = jest
      .fn()
      .mockImplementation((_branchId: string, _ingredientId: string, quantity: number) =>
        Promise.resolve({ ingredientId: 'i1', branchId: 'b1', quantity }),
      )
    const { repository, service } = makeService({
      findOne: jest.fn().mockResolvedValue(initial === null ? null : { quantity: initial }),
      setQuantity,
    })

    const result = await service.adjust('b1', 'i1', delta)

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', expected)
    expect(result.quantity).toBe(expected)
    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ delta, reason: STOCK_MOVEMENT_REASON.adjust }),
    )
  })

  it('registra el orderId cuando se informa', async () => {
    const { repository, service } = makeService({
      findOne: jest.fn().mockResolvedValue({ quantity: 10 }),
      setQuantity: jest
        .fn()
        .mockResolvedValue({ ingredientId: 'i1', branchId: 'b1', quantity: 15 }),
    })

    await service.adjust('b1', 'i1', 5, 'o1')

    expect(repository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o1', reason: STOCK_MOVEMENT_REASON.adjust }),
    )
  })

  it('devuelve el stock calculado si el repositorio no persiste documento', async () => {
    const { service } = makeService({
      findOne: jest.fn().mockResolvedValue(null),
      setQuantity: jest.fn().mockResolvedValue(null),
    })

    const result = await service.adjust('b1', 'i1', 4)

    expect(result).toEqual({ ingredientId: 'i1', branchId: 'b1', quantity: 4 })
  })

  // KNOWN BUG: un ajuste negativo mayor al stock recorta a 0 pero el movimiento conserva el
  // delta solicitado (-10) en lugar del cambio real (-2).
  it('registra el delta solicitado aunque el ajuste se recorte a 0', async () => {
    const { repository, service } = makeService({
      findOne: jest.fn().mockResolvedValue({ quantity: 2 }),
      setQuantity: jest.fn().mockResolvedValue(null),
    })

    await service.adjust('b1', 'i1', -10)

    expect(repository.setQuantity).toHaveBeenCalledWith('b1', 'i1', 0)
    expect(repository.createMovement).toHaveBeenCalledWith(expect.objectContaining({ delta: -10 }))
  })
})
