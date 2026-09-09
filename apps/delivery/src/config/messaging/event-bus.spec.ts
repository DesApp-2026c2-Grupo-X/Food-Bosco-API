import { EventBus } from './event-bus'
import type { OrderStatusChangedEvent } from './events'
import { InProcessTransport } from './in-process.transport'

const orderEvent = (overrides: Partial<OrderStatusChangedEvent> = {}): OrderStatusChangedEvent => ({
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: 0, longitude: 0 },
  deliveryAddress: { text: 'Av 123', latitude: 0.001, longitude: 0 },
  occurredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('EventBus (transporte en proceso)', () => {
  it('entrega el evento publicado a su handler suscripto', async () => {
    const bus = new EventBus(new InProcessTransport())
    const handler = jest.fn()

    await bus.subscribe('order.status_changed', handler)
    await bus.publish(orderEvent())

    expect(handler).toHaveBeenCalledWith(orderEvent())
    await bus.close()
  })

  it('no entrega eventos de otro tipo al handler', async () => {
    const bus = new EventBus(new InProcessTransport())
    const handler = jest.fn()

    await bus.subscribe('trip.accepted', handler)
    await bus.publish(orderEvent())

    expect(handler).not.toHaveBeenCalled()
    await bus.close()
  })

  it('permite cerrar sin handlers y publicar sin suscriptores', async () => {
    const bus = new EventBus(new InProcessTransport())

    await expect(bus.publish(orderEvent())).resolves.toBeUndefined()
    await expect(bus.close()).resolves.toBeUndefined()
  })
})
