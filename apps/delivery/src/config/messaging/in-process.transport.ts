import { EventEmitter } from 'node:events'
import type { DomainEvent } from './events'
import type { EventHandler, EventTransport } from './transport'

export class InProcessTransport implements EventTransport {
  private readonly emitter = new EventEmitter()

  async publish(event: DomainEvent): Promise<void> {
    this.emitter.emit(event.type, event)
  }

  async subscribe(type: string, handler: EventHandler): Promise<void> {
    this.emitter.on(type, (event: DomainEvent) => {
      void handler(event)
    })
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners()
  }
}
