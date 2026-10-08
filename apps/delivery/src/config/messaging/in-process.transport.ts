import { Logger } from '@nestjs/common'
import { EventEmitter } from 'node:events'
import type { DomainEvent } from './events'
import type { EventHandler, EventTransport } from './transport'

export class InProcessTransport implements EventTransport {
  private readonly logger = new Logger(InProcessTransport.name)
  private readonly emitter = new EventEmitter()

  async publish(event: DomainEvent): Promise<void> {
    this.emitter.emit(event.type, event)
  }

  async subscribe(type: string, handler: EventHandler): Promise<void> {
    this.emitter.on(type, (event: DomainEvent) => {
      void this.runHandler(type, handler, event)
    })
  }

  // NEW-22: un handler puede lanzar o rechazar. Se aísla en un wrapper async con
  // try/catch para que el fallo no genere un unhandled promise rejection ni impida
  // que otros suscriptores del mismo evento reciban la notificación.
  private async runHandler(type: string, handler: EventHandler, event: DomainEvent): Promise<void> {
    try {
      await handler(event)
    } catch (error) {
      this.logger.error(
        `handler de ${type} falló: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners()
  }
}
