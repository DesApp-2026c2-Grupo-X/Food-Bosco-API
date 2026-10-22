import { EventBus } from '../config/messaging/event-bus'
import { ORDER_STATUS_CHANGED_EVENT } from '../config/messaging/events'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import { InProcessTransport } from '../config/messaging/in-process.transport'
import type { EventHandler } from '../config/messaging/transport'
import { OrderEventsConsumer } from './order-events.consumer'
import { OrderLifecycleOrchestrator } from './order-lifecycle.orchestrator'

const orderEvent = (overrides: Partial<OrderStatusChangedEvent> = {}): OrderStatusChangedEvent => ({
  type: ORDER_STATUS_CHANGED_EVENT,
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: -34.6, longitude: -58.4 },
  deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
  occurredAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeConsumer = () => {
  const subscribe = jest.fn().mockResolvedValue(undefined)
  const eventBus = { subscribe } as unknown as EventBus
  const handleOrderStatusChanged = jest.fn().mockResolvedValue(undefined)
  const orchestrator = { handleOrderStatusChanged } as unknown as OrderLifecycleOrchestrator
  const consumer = new OrderEventsConsumer(eventBus, orchestrator)
  return { consumer, subscribe, handleOrderStatusChanged }
}

describe('OrderEventsConsumer (RQ-DLV-03)', () => {
  it('al inicializar se suscribe a order.status_changed', async () => {
    const { consumer, subscribe } = makeConsumer()

    await consumer.onModuleInit()

    expect(subscribe).toHaveBeenCalledWith(ORDER_STATUS_CHANGED_EVENT, expect.any(Function))
  })

  it.each([
    { name: 'READY_FOR_DELIVERY', status: 'ready_for_delivery' },
    { name: 'cancelled', status: 'cancelled' },
    { name: 'delivered', status: 'delivered' },
  ])('reenvía el evento $name al orchestrator', async ({ status }) => {
    const { consumer, subscribe, handleOrderStatusChanged } = makeConsumer()
    await consumer.onModuleInit()
    const handler = subscribe.mock.calls[0][1] as EventHandler

    await handler(orderEvent({ status }))

    expect(handleOrderStatusChanged).toHaveBeenCalledWith(orderEvent({ status }))
  })

  it('propaga el rechazo del orchestrator al handler suscripto', async () => {
    const { consumer, subscribe, handleOrderStatusChanged } = makeConsumer()
    handleOrderStatusChanged.mockRejectedValueOnce(new Error('orchestrator boom'))
    await consumer.onModuleInit()
    const handler = subscribe.mock.calls[0][1] as EventHandler

    await expect(handler(orderEvent())).rejects.toThrow('orchestrator boom')
  })
})

describe('OrderEventsConsumer + EventBus (wiring real, RQ-DLV-03)', () => {
  it('publica order.status_changed y llega al orchestrator a través del consumer', async () => {
    const bus = new EventBus(new InProcessTransport())
    const handleOrderStatusChanged = jest.fn().mockResolvedValue(undefined)
    const orchestrator = { handleOrderStatusChanged } as unknown as OrderLifecycleOrchestrator
    const consumer = new OrderEventsConsumer(bus, orchestrator)
    await consumer.onModuleInit()

    await bus.publish(orderEvent())

    expect(handleOrderStatusChanged).toHaveBeenCalledWith(orderEvent())
    await bus.close()
  })
})
