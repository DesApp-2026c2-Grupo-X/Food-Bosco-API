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
    {
      name: 'pendiente → confirmado',
      current: ORDER_STATUS.pending,
      target: ORDER_STATUS.confirmed,
      expected: 'ok',
    },
    {
      name: 'pendiente → cancelado',
      current: ORDER_STATUS.pending,
      target: ORDER_STATUS.cancelled,
      expected: 'ok',
    },
    {
      name: 'pendiente → en preparación (salto)',
      current: ORDER_STATUS.pending,
      target: ORDER_STATUS.preparing,
      expected: 'error',
    },
    {
      name: 'confirmado → en preparación',
      current: ORDER_STATUS.confirmed,
      target: ORDER_STATUS.preparing,
      expected: 'ok',
    },
    {
      name: 'confirmado → pendiente (retroceso)',
      current: ORDER_STATUS.confirmed,
      target: ORDER_STATUS.pending,
      expected: 'error',
    },
    {
      name: 'en preparación → listo',
      current: ORDER_STATUS.preparing,
      target: ORDER_STATUS.readyForDelivery,
      expected: 'ok',
    },
    {
      name: 'listo → en camino',
      current: ORDER_STATUS.readyForDelivery,
      target: ORDER_STATUS.onTheWay,
      expected: 'ok',
    },
    {
      name: 'en camino → entregado',
      current: ORDER_STATUS.onTheWay,
      target: ORDER_STATUS.delivered,
      expected: 'ok',
    },
    {
      name: 'entregado → en camino (retroceso)',
      current: ORDER_STATUS.delivered,
      target: ORDER_STATUS.onTheWay,
      expected: 'error',
    },
    {
      name: 'cancelado → confirmado',
      current: ORDER_STATUS.cancelled,
      target: ORDER_STATUS.confirmed,
      expected: 'error',
    },
    {
      name: 'entregado → cualquier estado',
      current: ORDER_STATUS.delivered,
      target: ORDER_STATUS.cancelled,
      expected: 'error',
    },
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
      status: 409,
      message: `Transición inválida: ${current} → ${target}`,
    })
  })
})

describe('OrderService.applyTransition — matriz completa de cancelación (RQ-ORD-14)', () => {
  const cases: Array<{
    name: string
    current: OrderStatus
    target: OrderStatus
    expected: 'ok' | 'error'
  }> = [
    {
      name: 'confirmado → cancelado',
      current: ORDER_STATUS.confirmed,
      target: ORDER_STATUS.cancelled,
      expected: 'ok',
    },
    {
      name: 'en preparación → cancelado',
      current: ORDER_STATUS.preparing,
      target: ORDER_STATUS.cancelled,
      expected: 'ok',
    },
    {
      name: 'listo → cancelado',
      current: ORDER_STATUS.readyForDelivery,
      target: ORDER_STATUS.cancelled,
      expected: 'ok',
    },
    {
      name: 'en camino → cancelado',
      current: ORDER_STATUS.onTheWay,
      target: ORDER_STATUS.cancelled,
      expected: 'ok',
    },
    {
      name: 'pendiente → listo (salto)',
      current: ORDER_STATUS.pending,
      target: ORDER_STATUS.readyForDelivery,
      expected: 'error',
    },
    {
      name: 'confirmado → en camino (salto)',
      current: ORDER_STATUS.confirmed,
      target: ORDER_STATUS.onTheWay,
      expected: 'error',
    },
    {
      name: 'cancelado → pendiente',
      current: ORDER_STATUS.cancelled,
      target: ORDER_STATUS.pending,
      expected: 'error',
    },
    {
      name: 'entregado → pendiente',
      current: ORDER_STATUS.delivered,
      target: ORDER_STATUS.pending,
      expected: 'error',
    },
  ]

  it.each(cases)('$name → $expected', async ({ current, target, expected }) => {
    const doc = buildDoc({ status: current })
    const service = makeService(doc)

    if (expected === 'ok') {
      const result = await service.applyTransition('o1', target)
      expect(result).toMatchObject({ changed: true, order: { status: target } })
      return
    }

    await expect(service.applyTransition('o1', target)).rejects.toMatchObject({
      code: ERROR_CODES.invalidTransition,
      status: 409,
      message: `Transición inválida: ${current} → ${target}`,
    })
    expect(doc.status).toBe(current)
    expect(doc.statusHistory).toHaveLength(0)
  })
})

describe('OrderService.list — paginación (RQ-ORD-11/19)', () => {
  const docWithId = (id: string): OrderDocument => buildDoc({ _id: { toString: () => id } })

  it.each([
    { name: 'primera página', limit: 20, offset: 0, total: 2, expectedIds: ['o1', 'o2'] },
    { name: 'tamaño 1 desde offset 1', limit: 1, offset: 1, total: 2, expectedIds: ['o2'] },
    { name: 'offset posterior al total', limit: 20, offset: 50, total: 2, expectedIds: [] },
  ])(
    '$name → meta con limit/offset y $expectedIds',
    async ({ limit, offset, total, expectedIds }) => {
      const docs = expectedIds.map(docWithId)
      const repository = {
        list: jest.fn().mockResolvedValue({ data: docs, total }),
      }
      const service = new OrderService(repository as unknown as OrderRepository)
      const query = { clientId: 'c1', limit, offset }

      const result = await service.list(query)

      expect(repository.list).toHaveBeenCalledWith(query)
      expect(result.meta).toEqual({ total, limit, offset })
      expect(result.data.map((entry) => entry.id)).toEqual(expectedIds)
    },
  )

  it('serializa el detalle y el historial de cada pedido', async () => {
    const doc = buildDoc({
      items: [
        {
          productId: 'p1',
          name: 'Hamburguesa',
          unitPrice: 150,
          quantity: 2,
          observations: 'sin sal',
          subtotal: 300,
          options: [{ optionId: 'opt1', name: 'Doble', extraPrice: 50 }],
        },
      ],
      statusHistory: [
        {
          previousStatus: ORDER_STATUS.pending,
          newStatus: ORDER_STATUS.confirmed,
          changedAt: new Date('2026-01-01T01:00:00.000Z'),
        },
      ],
    })
    const repository = { list: jest.fn().mockResolvedValue({ data: [doc], total: 1 }) }
    const service = new OrderService(repository as unknown as OrderRepository)

    const result = await service.list({ limit: 20, offset: 0 })

    expect(result.data[0].items[0]).toMatchObject({
      name: 'Hamburguesa',
      unitPrice: 150,
      observations: 'sin sal',
      subtotal: 300,
      options: [{ optionId: 'opt1', name: 'Doble', extraPrice: 50 }],
    })
    expect(result.data[0].statusHistory[0].changedAt).toBe('2026-01-01T01:00:00.000Z')
  })
})

describe('OrderService.create — numeración y estado inicial (RQ-ORD-07/08)', () => {
  const makeCreateService = (count: number) => {
    const created = buildDoc({ number: String(count + 1).padStart(6, '0') })
    const repository = {
      count: jest.fn().mockResolvedValue(count),
      create: jest.fn().mockResolvedValue(created),
    }
    return {
      service: new OrderService(repository as unknown as OrderRepository),
      repository,
      created,
    }
  }

  const input = {
    clientId: 'c1',
    branchId: 'b1',
    addressId: 'a1',
    deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
    total: 100,
    estimatedDeliveryAt: null,
    items: [],
  }

  it.each([
    { name: 'primer pedido', count: 0, expected: '000001' },
    { name: 'pedido 122', count: 122, expected: '000123' },
    { name: 'último de 6 dígitos', count: 999998, expected: '999999' },
    { name: 'desborde de 6 dígitos (no trunca)', count: 999999, expected: '1000000' },
  ])('$name → $expected', async ({ count, expected }) => {
    const { service, repository } = makeCreateService(count)

    await service.create(input)

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ number: expected, clientId: 'c1', branchId: 'b1', total: 100 }),
      expect.objectContaining({
        previousStatus: ORDER_STATUS.pending,
        newStatus: ORDER_STATUS.pending,
        changedAt: expect.any(Date),
      }),
    )
  })

  it('propaga el snapshot de dirección y los ítems al repositorio', async () => {
    const { service, repository } = makeCreateService(0)
    const items = [
      {
        productId: 'p1',
        name: 'Hamburguesa',
        unitPrice: 150,
        quantity: 2,
        observations: null,
        subtotal: 300,
        options: [{ optionId: 'opt1', name: 'Doble', extraPrice: 50 }],
      },
    ]

    await service.create({ ...input, items })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items,
        deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
      }),
      expect.anything(),
    )
  })
})

describe('OrderService.markAssigned (RQ-ORD-16)', () => {
  it.each([
    { name: 'un pedido', orderIds: ['o1'], tripId: 't1', riderId: 'r1' },
    { name: 'varios pedidos', orderIds: ['o1', 'o2', 'o3'], tripId: 't2', riderId: 'r2' },
  ])('delega $name al repositorio', async ({ orderIds, tripId, riderId }) => {
    const repository = { markAssigned: jest.fn().mockResolvedValue(undefined) }
    const service = new OrderService(repository as unknown as OrderRepository)

    await service.markAssigned(orderIds, tripId, riderId)

    expect(repository.markAssigned).toHaveBeenCalledWith(orderIds, tripId, riderId)
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

describe('OrderService.releaseRider (RQ-ORD-16)', () => {
  it('antes del retiro vuelve el pedido a listo para entregar y libera al rider', async () => {
    const doc = buildDoc({ status: ORDER_STATUS.readyForDelivery, riderId: 'r1', tripId: 't1' })
    const service = makeService(doc)

    const result = await service.releaseRider('o1', { allowAfterPickup: false })

    expect(result?.changed).toBe(true)
    expect(result?.order.status).toBe(ORDER_STATUS.readyForDelivery)
    expect(result?.order.riderId).toBeNull()
    expect(result?.order.tripId).toBeNull()
    expect(result?.order.cancelReason).toBeNull()
  })

  it('si ya fue retirado, cancela el pedido y lo marca como robado', async () => {
    const doc = buildDoc({ status: ORDER_STATUS.onTheWay, riderId: 'r1', tripId: 't1' })
    const service = makeService(doc)

    const result = await service.releaseRider('o1', { allowAfterPickup: true })

    expect(result?.order.status).toBe(ORDER_STATUS.cancelled)
    expect(result?.order.cancelReason).toBe('lost')
    expect(result?.order.riderId).toBeNull()
    expect(doc.statusHistory.at(-1)?.newStatus).toBe(ORDER_STATUS.cancelled)
  })

  it('el rider no puede liberar un pedido ya retirado', async () => {
    const doc = buildDoc({ status: ORDER_STATUS.onTheWay, riderId: 'r1', tripId: 't1' })
    const service = makeService(doc)

    await expect(service.releaseRider('o1', { allowAfterPickup: false })).rejects.toMatchObject({
      code: ERROR_CODES.invalidTransition,
    })
  })

  it('rechaza liberar un pedido sin rider asignado', async () => {
    const service = makeService(buildDoc({ status: ORDER_STATUS.pending }))

    await expect(service.releaseRider('o1', { allowAfterPickup: true })).rejects.toMatchObject({
      code: ERROR_CODES.invalidTransition,
    })
  })

  it('devuelve null cuando el pedido no existe', async () => {
    const service = makeService(null)

    await expect(service.releaseRider('o1', { allowAfterPickup: true })).resolves.toBeNull()
  })
})
