import { connect } from 'amqplib'
import type { Channel, ChannelModel } from 'amqplib'
import type { DomainEvent } from './events'
import type { EventHandler, EventTransport } from './transport'

const EXCHANGE = 'fastfood.events'
const QUEUE_PREFIX = 'delivery'

export class RabbitTransport implements EventTransport {
  private connection: ChannelModel | null = null
  private channel: Channel | null = null
  private connectPromise: Promise<Channel> | null = null

  constructor(private readonly url: string) {}

  private ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return Promise.resolve(this.channel)
    }
    if (!this.connectPromise) {
      this.connectPromise = this.open()
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
          const event = JSON.parse(message.content.toString()) as DomainEvent
          void handler(event)
        }
      },
      { noAck: true },
    )
  }

  async close(): Promise<void> {
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
