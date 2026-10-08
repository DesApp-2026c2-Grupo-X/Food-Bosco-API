import { Logger } from '@nestjs/common'
import { connect } from 'amqplib'
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib'
import type { DomainEvent } from './events'
import type { EventHandler, EventTransport } from './transport'

const EXCHANGE = 'fastfood.events'
const QUEUE_PREFIX = 'delivery'

// NEW-24: máximo de intentos de entrega antes de descartar un mensaje cuyo handler
// falla de forma determinística (evita el bucle de nack(requeue=true)).
const MAX_DELIVERY_ATTEMPTS = 3

export class RabbitTransport implements EventTransport {
  private readonly logger = new Logger(RabbitTransport.name)
  private connection: ChannelModel | null = null
  private channel: Channel | null = null
  private connectPromise: Promise<Channel> | null = null

  constructor(private readonly url: string) {}

  private ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return Promise.resolve(this.channel)
    }
    if (!this.connectPromise) {
      this.connectPromise = this.open().catch((error) => {
        this.connectPromise = null
        throw error
      })
    }
    return this.connectPromise
  }

  private async open(): Promise<Channel> {
    this.connection = await connect(this.url)
    const channel = await this.connection.createChannel()
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
    this.channel = channel
    return channel
  }

  async publish(event: DomainEvent): Promise<void> {
    const channel = await this.ensureChannel()
    channel.publish(EXCHANGE, event.type, Buffer.from(JSON.stringify(event)), { persistent: true })
  }

  async subscribe(type: string, handler: EventHandler): Promise<void> {
    const channel = await this.ensureChannel()
    const queueName = `${QUEUE_PREFIX}.${type}`
    await channel.assertQueue(queueName, { durable: true })
    await channel.bindQueue(queueName, EXCHANGE, type)
    await channel.consume(
      queueName,
      (message) => {
        if (message) {
          void this.dispatch(channel, message, handler)
        }
      },
      { noAck: false },
    )
  }

  // Ack explícito + reintento: si el handler falla, el mensaje se reencola (nack sin
  // descartar) para no perderlo. Un payload ilegible se descarta para evitar bucles.
  private async dispatch(
    channel: Channel,
    message: ConsumeMessage,
    handler: EventHandler,
  ): Promise<void> {
    let event: DomainEvent
    try {
      event = JSON.parse(message.content.toString()) as DomainEvent
    } catch {
      await this.settle(() => channel.ack(message))
      return
    }

    try {
      await handler(event)
      await this.settle(() => channel.ack(message))
    } catch {
      if (this.exhaustedRetries(message)) {
        // NEW-24: sin DLQ configurada, un fallo determinístico que agota los reintentos
        // se descarta (ack) en lugar de reencolar indefinidamente.
        this.logger.error(
          `reintentos agotados (${MAX_DELIVERY_ATTEMPTS}); se descarta el evento ${event.eventId}`,
        )
        await this.settle(() => channel.ack(message))
        return
      }
      await this.settle(() => channel.nack(message, false, true))
    }
  }

  // NEW-24: ack/nack lanzan si el canal se cerró; se envuelven para que un fallo de
  // confirmación no genere un rechazo sin capturar ni rompa el consumidor.
  private async settle(action: () => void | Promise<void>): Promise<void> {
    try {
      await action()
    } catch (error) {
      this.logger.warn(
        `no se pudo confirmar el mensaje (¿canal cerrado?): ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  // NEW-24: cuenta los intentos combinando el header `x-death` (DLX) con el flag
  // `redelivered` del broker, que sólo indica una reentrega previa.
  private deliveryAttempts(message: ConsumeMessage): number {
    const deaths = message.properties?.headers?.['x-death']
    const deadLettered = Array.isArray(deaths)
      ? deaths.reduce((total: number, death) => total + (Number(death?.count) || 1), 0)
      : 0
    const redelivered = message.fields?.redelivered ? 1 : 0
    return deadLettered + redelivered
  }

  private exhaustedRetries(message: ConsumeMessage): boolean {
    return this.deliveryAttempts(message) >= MAX_DELIVERY_ATTEMPTS
  }

  async close(): Promise<void> {
    this.connectPromise = null
    if (this.channel) {
      await this.channel.close().catch(() => undefined)
      this.channel = null
    }
    if (this.connection) {
      await this.connection.close().catch(() => undefined)
      this.connection = null
    }
  }
}
