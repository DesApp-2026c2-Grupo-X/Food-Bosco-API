import { DeliveryOrder, DeliveryOrderDocument } from './delivery-order.model'
import { DeliveryOrderRepository } from './delivery-order.repository'
import { DeliveryOrderService } from './delivery-order.service'
import type { OrderStatusChangedEvent } from '../config/messaging/events'

const buildDoc = (overrides: Partial<DeliveryOrder> = {}): DeliveryOrderDocument =>
  ({
    _id: { toString: () => 'o1' },
    orderId: 'ord-1',
    branchId: 'b1',
    branchLocation: { latitude: -34.6, longitude: -58.4 },
    deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
    status: 'ready',
    tripId: null,
    reservedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as unknown as DeliveryOrderDocument

const event = (status: string): OrderStatusChangedEvent => ({
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status,
  branchId: 'b1',
  branchLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  occurredAt: '2026-01-01T00:00:00.000Z',
})

describe('DeliveryOrderService.handleOrderStatusChanged (RQ-DLV-03)', () => {
  const repository = { upsertReady: jest.fn(), remove: jest.fn() }
  const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

  beforeEach(() => jest.clearAllMocks())

  it('agrega la orden al pool cuando pasa a READY_FOR_DELIVERY', async () => {
    await service.handleOrderStatusChanged(event('ready_for_delivery'))

    expect(repository.upsertReady).toHaveBeenCalledWith({
      orderId: 'ord-1',
      branchId: 'b1',
      branchLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
    })
  })

  it.each(['cancelled', 'delivered'])('quita la orden del pool si pasa a %s', async (status) => {
    await service.handleOrderStatusChanged(event(status))

    expect(repository.remove).toHaveBeenCalledWith('ord-1')
    expect(repository.upsertReady).not.toHaveBeenCalled()
  })

  it.each(['pending', 'confirmed', 'preparing', 'on_the_way'])(
    'ignora el estado %s',
    async (status) => {
      await service.handleOrderStatusChanged(event(status))

      expect(repository.upsertReady).not.toHaveBeenCalled()
      expect(repository.remove).not.toHaveBeenCalled()
    },
  )
})

describe('DeliveryOrderService.listAvailable / reserve / release', () => {
  it('lista solo las órdenes disponibles serializadas', async () => {
    const repository = { listReady: jest.fn().mockResolvedValue([buildDoc()]) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.listAvailable()

    expect(result).toHaveLength(1)
    expect(result[0].orderId).toBe('ord-1')
    expect(result[0].branchId).toBe('b1')
  })

  it('reserva un conjunto de órdenes con fecha límite', async () => {
    const repository = { reserve: jest.fn().mockResolvedValue(undefined) }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)
    const until = new Date('2026-01-01T00:01:00.000Z')

    await service.reserve(['ord-1', 'ord-2'], 't1', until)

    expect(repository.reserve).toHaveBeenCalledWith(['ord-1', 'ord-2'], 't1', until)
  })

  it('releaseExpired deduplica los tripIds liberados', async () => {
    const repository = {
      findExpiredReservations: jest.fn().mockResolvedValue(['t1', 't1', 't2']),
      releaseExpired: jest.fn().mockResolvedValue(undefined),
    }
    const service = new DeliveryOrderService(repository as unknown as DeliveryOrderRepository)

    const result = await service.releaseExpired(new Date())

    expect(result).toEqual(['t1', 't2'])
    expect(repository.releaseExpired).toHaveBeenCalled()
  })
})
