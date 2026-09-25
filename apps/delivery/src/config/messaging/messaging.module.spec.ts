import { Test } from '@nestjs/testing'
import { env } from '../env'
import { EventBus } from './event-bus'
import type { OrderStatusChangedEvent } from './events'
import { InProcessTransport } from './in-process.transport'
import { MessagingModule } from './messaging.module'
import { RabbitTransport } from './rabbit.transport'

const transportOf = (bus: EventBus): unknown => (bus as unknown as { transport: unknown }).transport

const event: OrderStatusChangedEvent = {
  type: 'order.status_changed',
  version: 1,
  eventId: 'e1',
  orderId: 'ord-1',
  status: 'ready_for_delivery',
  branchId: 'b1',
  branchLocation: { latitude: 0, longitude: 0 },
  deliveryAddress: { text: 'Av', latitude: 0.001, longitude: 0 },
  occurredAt: '2026-01-01T00:00:00.000Z',
}

describe('MessagingModule (fallback sin broker)', () => {
  const originalBrokerUrl = env.brokerUrl

  afterEach(() => {
    env.brokerUrl = originalBrokerUrl
  })

  it('usa InProcessTransport cuando no hay brokerUrl', async () => {
    env.brokerUrl = ''
    const moduleRef = await Test.createTestingModule({ imports: [MessagingModule] }).compile()

    const bus = moduleRef.get(EventBus)

    expect(transportOf(bus)).toBeInstanceOf(InProcessTransport)
    await moduleRef.close()
  })

  it('usa RabbitTransport cuando hay brokerUrl (sin abrir conexión)', async () => {
    env.brokerUrl = 'amqp://broker'
    const moduleRef = await Test.createTestingModule({ imports: [MessagingModule] }).compile()

    const bus = moduleRef.get(EventBus)

    expect(transportOf(bus)).toBeInstanceOf(RabbitTransport)
    await moduleRef.close()
  })

  it('entrega eventos de punta a punta con el transporte en proceso', async () => {
    env.brokerUrl = ''
    const moduleRef = await Test.createTestingModule({ imports: [MessagingModule] }).compile()
    const bus = moduleRef.get(EventBus)
    const handler = jest.fn()

    await bus.subscribe('order.status_changed', handler)
    await bus.publish(event)

    expect(handler).toHaveBeenCalledWith(event)
    await moduleRef.close()
  })
})
