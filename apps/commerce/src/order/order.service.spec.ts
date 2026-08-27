import { ERROR_CODES, ORDER_STATUS } from '../config/constants'
import type { OrderStatus } from '../config/constants'
import type { OrderDocument } from './order.model'
import { OrderRepository } from './order.repository'
import { OrderService } from './order.service'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): OrderDocument =>
  ({
    _id: { toString: () => 'o1' },
    number: '000001',
    clientId: 'c1',
    branchId: 'b1',
    addressId: 'a1',
    deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
    status: ORDER_STATUS.pending,
    total: 100,
    estimatedDeliveryAt: null,
    riderId: null,
    tripId: null,
    items: [],
    statusHistory: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn(function (this: OrderDocument) {
      return Promise.resolve(this)
    }),
    ...overrides,
  }) as unknown as OrderDocument

const makeService = (doc: OrderDocument | null) => {
  const repository = {
    findById: jest.fn().mockResolvedValue(doc),
    save: jest.fn().mockImplementation((d: OrderDocument) => Promise.resolve(d)),
  }
  return new OrderService(repository as unknown as OrderRepository)
}

describe('OrderService.applyTransition (RQ-ORD-14/15)', () => {
  const cases: Array<{
    name: string
    current: OrderStatus
    target: OrderStatus
    expected: 'ok' | 'error'
  }> = [
    { name: 'pendiente → confirmado', current: ORDER_STATUS.pending, target: ORDER_STATUS.confirmed, expected: 'ok' },
    { name: 'pendiente → cancelado', current: ORDER_STATUS.pending, target: ORDER_STATUS.cancelled, expected: 'ok' },
    { name: 'pendiente → en preparación (salto)', current: ORDER_STATUS.pending, target: ORDER_STATUS.preparing, expected: 'error' },
    { name: 'confirmado → en preparación', current: ORDER_STATUS.confirmed, target: ORDER_STATUS.preparing, expected: 'ok' },
    { name: 'confirmado → pendiente (retroceso)', current: ORDER_STATUS.confirmed, target: ORDER_STATUS.pending, expected: 'error' },
    { name: 'en preparación → listo', current: ORDER_STATUS.preparing, target: ORDER_STATUS.readyForDelivery, expected: 'ok' },
    { name: 'listo → en camino', current: ORDER_STATUS.readyForDelivery, target: ORDER_STATUS.onTheWay, expected: 'ok' },
    { name: 'en camino → entregado', current: ORDER_STATUS.onTheWay, target: ORDER_STATUS.delivered, expected: 'ok' },
    { name: 'entregado → en camino (retroceso)', current: ORDER_STATUS.delivered, target: ORDER_STATUS.onTheWay, expected: 'error' },
    { name: 'cancelado → confirmado', current: ORDER_STATUS.cancelled, target: ORDER_STATUS.confirmed, expected: 'error' },
    { name: 'entregado → cualquier estado', current: ORDER_STATUS.delivered, target: ORDER_STATUS.cancelled, expected: 'error' },
  ]

  it.each(cases)('$name → $expected', async ({ current, target, expected }) => {
    const service = makeService(buildDoc({ status: current }))

    if (expected === 'ok') {
      const result = await service.applyTransition('o1', target)
      expect(result?.changed).toBe(true)
      expect(result?.order.status).toBe(target)
      return
    }

    await expect(service.applyTransition('o1', target)).rejects.toMatchObject({
      code: ERROR_CODES.invalidTransition,
    })
  })
})

describe('OrderService.applyTransition — idempotencia (NFR-04)', () => {
  it('no cambia ni agrega historial si el estado es el mismo', async () => {
    const doc = buildDoc({ status: ORDER_STATUS.confirmed })
    const service = makeService(doc)

    const result = await service.applyTransition('o1', ORDER_STATUS.confirmed)

    expect(result?.changed).toBe(false)
    expect(doc.statusHistory).toHaveLength(0)
  })
})

describe('OrderService.applyTransition — historial', () => {
  it('registra estado anterior, nuevo y fecha', async () => {
    const doc = buildDoc({ status: ORDER_STATUS.confirmed })
    const service = makeService(doc)

    await service.applyTransition('o1', ORDER_STATUS.preparing)

    expect(doc.statusHistory).toHaveLength(1)
    expect(doc.statusHistory[0].previousStatus).toBe(ORDER_STATUS.confirmed)
    expect(doc.statusHistory[0].newStatus).toBe(ORDER_STATUS.preparing)
    expect(doc.statusHistory[0].changedAt).toBeInstanceOf(Date)
  })
})

describe('OrderService.applyTransition — pedido inexistente', () => {
  it('devuelve null si no encuentra el pedido', async () => {
    const service = makeService(null)
    await expect(service.applyTransition('missing', ORDER_STATUS.confirmed)).resolves.toBeNull()
  })
})

describe('OrderService.create (RQ-ORD-07/08)', () => {
  it('genera un número secuencial zero-padded e inicia en pendiente', async () => {
    const repository = {
      count: jest.fn().mockResolvedValue(122),
      create: jest.fn().mockResolvedValue(buildDoc({ number: '000123' })),
    }
    const service = new OrderService(repository as unknown as OrderRepository)

    const result = await service.create({
      clientId: 'c1',
      branchId: 'b1',
      addressId: 'a1',
      deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      total: 100,
      estimatedDeliveryAt: null,
      items: [],
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ number: '000123' }),
      expect.objectContaining({ newStatus: ORDER_STATUS.pending }),
    )
    expect(result.status).toBe(ORDER_STATUS.pending)
  })
})
