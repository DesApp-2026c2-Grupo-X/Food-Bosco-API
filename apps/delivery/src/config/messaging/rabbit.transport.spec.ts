import { connect } from 'amqplib'
import type { DomainEvent, OrderStatusChangedEvent } from './events'
import type { EventHandler } from './transport'
import { RabbitTransport } from './rabbit.transport'

jest.mock('amqplib', () => ({ connect: jest.fn() }))

const connectMock = connect as unknown as jest.Mock

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

const makeChannel = () => ({
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue(undefined),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn(),
  consume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
})

const makeConnection = (channel: ReturnType<typeof makeChannel>) => ({
  createChannel: jest.fn().mockResolvedValue(channel),
  close: jest.fn().mockResolvedValue(undefined),
})

const setup = () => {
  const channel = makeChannel()
  const connection = makeConnection(channel)
  connectMock.mockResolvedValue(connection)
  const transport = new RabbitTransport('amqp://broker')
  return { transport, channel, connection }
}

describe('RabbitTransport.publish (sin broker real)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('abre conexión, declara el exchange y publica persistente por tipo de evento', async () => {
    const { transport, channel, connection } = setup()

    await transport.publish(event)

    expect(connectMock).toHaveBeenCalledWith('amqp://broker')
    expect(connection.createChannel).toHaveBeenCalledTimes(1)
    expect(channel.assertExchange).toHaveBeenCalledWith('fastfood.events', 'topic', {
      durable: true,
    })
    expect(channel.publish).toHaveBeenCalledWith(
      'fastfood.events',
      'order.status_changed',
      expect.any(Buffer),
      { persistent: true },
    )
    const buffer = channel.publish.mock.calls[0][2] as Buffer
    expect(JSON.parse(buffer.toString())).toEqual(event)
  })

  it('reutiliza la conexión y el canal en publicaciones posteriores', async () => {
    const { transport } = setup()

    await transport.publish(event)
    await transport.publish({ ...event, eventId: 'e2' })

    expect(connectMock).toHaveBeenCalledTimes(1)
  })

  it('serializa conexiones concurrentes en una sola apertura', async () => {
    const { transport } = setup()

    await Promise.all([transport.publish(event), transport.publish({ ...event, eventId: 'e2' })])

    expect(connectMock).toHaveBeenCalledTimes(1)
  })

  it('propaga el fallo de conexión al publicar', async () => {
    connectMock.mockRejectedValue(new Error('broker caído'))
    const transport = new RabbitTransport('amqp://broker')

    await expect(transport.publish(event)).rejects.toThrow('broker caído')
  })
})

describe('RabbitTransport.subscribe (sin broker real)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('declara la cola durable, la bindea al exchange y consume con noAck', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()

    await transport.subscribe('order.status_changed', handler)

    expect(channel.assertQueue).toHaveBeenCalledWith('delivery.order.status_changed', {
      durable: true,
    })
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'delivery.order.status_changed',
      'fastfood.events',
      'order.status_changed',
    )
    expect(channel.consume).toHaveBeenCalledWith(
      'delivery.order.status_changed',
      expect.any(Function),
      { noAck: true },
    )
  })

  it('deserializa el mensaje y lo entrega al handler', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer({ content: Buffer.from(JSON.stringify(event)) })

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('ignora mensajes nulos del broker', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(null)

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('RabbitTransport.close (sin broker real)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('cierra canal y conexión, y es idempotente', async () => {
    const { transport, channel, connection } = setup()
    await transport.publish(event)

    await transport.close()
    await transport.close()

    expect(channel.close).toHaveBeenCalledTimes(1)
    expect(connection.close).toHaveBeenCalledTimes(1)
  })

  it('cierra sin haber conectado nunca', async () => {
    const transport = new RabbitTransport('amqp://broker')

    await expect(transport.close()).resolves.toBeUndefined()
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('traga los errores de cierre para no romper el shutdown', async () => {
    const { transport, channel, connection } = setup()
    channel.close.mockRejectedValue(new Error('channel close falló'))
    connection.close.mockRejectedValue(new Error('connection close falló'))
    await transport.publish(event)

    await expect(transport.close()).resolves.toBeUndefined()
  })

  // KNOWN BUG: close() limpia channel/connection pero no connectPromise. Una publicación
  // posterior a close() reutiliza el canal ya cerrado en lugar de reconectar.
  it('KNOWN BUG: no reconecta tras close(): publica sobre el canal cerrado', async () => {
    const { transport, channel } = setup()
    await transport.publish(event)
    await transport.close()

    await transport.publish({ ...event, eventId: 'e2' })

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(channel.publish).toHaveBeenCalledTimes(2)
  })
})

describe('RabbitTransport tipado', () => {
  it('transporta cualquier DomainEvent por su type', async () => {
    const { transport, channel } = setup()
    const tripAccepted: DomainEvent = {
      type: 'trip.accepted',
      version: 1,
      eventId: 'e9',
      tripId: 't1',
      riderId: 'u1',
      orderIds: ['ord-1'],
    }

    await transport.publish(tripAccepted)

    expect(channel.publish).toHaveBeenCalledWith(
      'fastfood.events',
      'trip.accepted',
      expect.any(Buffer),
      { persistent: true },
    )
  })
})
