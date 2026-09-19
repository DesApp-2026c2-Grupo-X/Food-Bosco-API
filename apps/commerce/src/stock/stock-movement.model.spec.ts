import { STOCK_MOVEMENT_REASON } from '../config/constants'
import type { StockMovementDocument } from './stock-movement.model'
import { serializeStockMovement } from './stock-movement.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): StockMovementDocument =>
  ({
    _id: { toString: () => 'm1' },
    branchId: 'b1',
    ingredientId: 'i1',
    delta: -2,
    reason: STOCK_MOVEMENT_REASON.preparing,
    orderId: 'o1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as StockMovementDocument

describe('serializeStockMovement (RQ-STK-04/08)', () => {
  it.each([
    {
      name: 'descuento por preparación con pedido',
      overrides: {},
      expected: {
        id: 'm1',
        branchId: 'b1',
        ingredientId: 'i1',
        delta: -2,
        reason: STOCK_MOVEMENT_REASON.preparing,
        orderId: 'o1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    {
      name: 'ajuste manual sin pedido',
      overrides: {
        delta: 10,
        reason: STOCK_MOVEMENT_REASON.adjust,
        orderId: null,
      },
      expected: {
        id: 'm1',
        branchId: 'b1',
        ingredientId: 'i1',
        delta: 10,
        reason: STOCK_MOVEMENT_REASON.adjust,
        orderId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  ])('$name → $expected', ({ overrides, expected }) => {
    expect(serializeStockMovement(buildDoc(overrides))).toEqual(expected)
  })

  it('normaliza orderId ausente a null', () => {
    expect(serializeStockMovement(buildDoc({ orderId: undefined })).orderId).toBeNull()
  })

  it('formatea createdAt como ISO', () => {
    const doc = buildDoc({ createdAt: new Date('2026-02-03T04:05:06.789Z') })

    expect(serializeStockMovement(doc).createdAt).toBe('2026-02-03T04:05:06.789Z')
  })
})
