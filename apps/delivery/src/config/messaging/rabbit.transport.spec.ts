import { Logger } from '@nestjs/common'
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
  ack: jest.fn(),
  nack: jest.fn(),
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

  const flush = () => new Promise((resolve) => setImmediate(resolve))

  it('declara la cola durable, la bindea al exchange y consume con ack explícito', async () => {
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
      { noAck: false },
    )
  })

  it('deserializa el mensaje, lo entrega al handler y hace ack tras el éxito', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()
    const message = { content: Buffer.from(JSON.stringify(event)) }

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(message)
    await flush()

    expect(handler).toHaveBeenCalledWith(event)
    expect(channel.ack).toHaveBeenCalledWith(message)
    expect(channel.nack).not.toHaveBeenCalled()
  })

  it('NEW-12: reencola (nack con requeue) si el handler falla, sin hacer ack', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn().mockRejectedValue(new Error('handler caído'))
    const message = { content: Buffer.from(JSON.stringify(event)) }

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(message)
    await flush()

    expect(channel.nack).toHaveBeenCalledWith(message, false, true)
    expect(channel.ack).not.toHaveBeenCalled()
  })

  it('NEW-12: descarta un payload ilegible sin invocar al handler ni reencolarlo', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()
    const message = { content: Buffer.from('no-es-json') }

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(message)
    await flush()

    expect(handler).not.toHaveBeenCalled()
    expect(channel.ack).toHaveBeenCalledWith(message)
    expect(channel.nack).not.toHaveBeenCalled()
  })

  it('ignora mensajes nulos del broker', async () => {
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()

    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(null)
    await flush()

    expect(handler).not.toHaveBeenCalled()
    expect(channel.ack).not.toHaveBeenCalled()
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

  // RQ-COM-04 / ciclo de vida: tras close() el transporte debe reconectar de forma
  // explícita en lugar de publicar sobre el canal cerrado.
  it('reconecta tras close() y vuelve a publicar sobre un canal nuevo', async () => {
    const { transport, channel, connection } = setup()
    await transport.publish(event)
    await transport.close()

    await transport.publish({ ...event, eventId: 'e2' })

    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(connection.createChannel).toHaveBeenCalledTimes(2)
    expect(channel.publish).toHaveBeenCalledTimes(2)
  })

  it('reintenta la conexión tras un fallo previo en lugar de reusar la promesa rechazada', async () => {
    const channel = makeChannel()
    const connection = makeConnection(channel)
    connectMock.mockRejectedValueOnce(new Error('broker caído')).mockResolvedValue(connection)
    const transport = new RabbitTransport('amqp://broker')

    await expect(transport.publish(event)).rejects.toThrow('broker caído')
    await transport.publish({ ...event, eventId: 'e2' })

    expect(connectMock).toHaveBeenCalledTimes(2)
    expect(channel.publish).toHaveBeenCalledTimes(1)
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

describe('RabbitTransport.dispatch: confirmaciones y límite de reintentos (NEW-24)', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => jest.restoreAllMocks())

  const flush = () => new Promise((resolve) => setImmediate(resolve))

  const consumeMessage = async (
    channel: ReturnType<typeof makeChannel>,
    transport: RabbitTransport,
    handler: EventHandler,
    message: unknown,
  ) => {
    await transport.subscribe('order.status_changed', handler)
    const consumer = channel.consume.mock.calls[0][1] as (message: unknown) => void
    consumer(message)
    await flush()
  }

  it('un ack que lanza por canal cerrado se traga y no rompe el consumidor', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()
    channel.ack.mockImplementation(() => {
      throw new Error('channel closed')
    })

    await consumeMessage(channel, transport, handler, {
      content: Buffer.from(JSON.stringify(event)),
    })

    expect(handler).toHaveBeenCalledWith(event)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('channel closed'))
  })

  it('un ack que devuelve promesa rechazada también se captura', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn()
    channel.ack.mockImplementation(() => Promise.reject(new Error('ack timeout')))

    await consumeMessage(channel, transport, handler, {
      content: Buffer.from(JSON.stringify(event)),
    })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ack timeout'))
  })

  it('un nack que lanza por canal cerrado se traga y no rompe el consumidor', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn().mockRejectedValue(new Error('handler caído'))
    channel.nack.mockImplementation(() => {
      throw new Error('channel closed')
    })

    await consumeMessage(channel, transport, handler, {
      content: Buffer.from(JSON.stringify(event)),
    })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('channel closed'))
  })

  type RetryCase = {
    name: string
    headers?: Record<string, unknown>
    redelivered?: boolean
    requeue: boolean
  }

  const retryCases: RetryCase[] = [
    { name: 'primer intento', requeue: true },
    { name: 'reentrega sin x-death', redelivered: true, requeue: true },
    {
      name: 'x-death count=1 + redelivered (bajo el umbral)',
      headers: { 'x-death': [{ count: 1 }] },
      redelivered: true,
      requeue: true,
    },
    {
      name: 'x-death count=1 + count=2 (suma en el umbral)',
      headers: { 'x-death': [{ count: 1 }, { count: 2 }] },
      requeue: false,
    },
    {
      name: 'x-death count=3 (en el umbral)',
      headers: { 'x-death': [{ count: 3 }] },
      requeue: false,
    },
  ]

  it.each(retryCases)('NEW-24: $name → $requeue', async ({ headers, redelivered, requeue }) => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn().mockRejectedValue(new Error('fallo'))
    const message = {
      content: Buffer.from(JSON.stringify(event)),
      properties: headers ? { headers } : {},
      fields: { redelivered: Boolean(redelivered) },
    }

    await consumeMessage(channel, transport, handler, message)

    if (requeue) {
      expect(channel.nack).toHaveBeenCalledWith(message, false, true)
      expect(channel.ack).not.toHaveBeenCalled()
    } else {
      expect(channel.ack).toHaveBeenCalledWith(message)
      expect(channel.nack).not.toHaveBeenCalled()
    }
  })

  it('NEW-24: al exceder reintentos loguea el descarte del evento', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const { transport, channel } = setup()
    const handler: EventHandler = jest.fn().mockRejectedValue(new Error('fallo determinístico'))
    const message = {
      content: Buffer.from(JSON.stringify(event)),
      properties: { headers: { 'x-death': [{ count: 3 }] } },
      fields: { redelivered: true },
    }

    await consumeMessage(channel, transport, handler, message)

    expect(channel.ack).toHaveBeenCalledWith(message)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('reintentos agotados'))
  })
})
