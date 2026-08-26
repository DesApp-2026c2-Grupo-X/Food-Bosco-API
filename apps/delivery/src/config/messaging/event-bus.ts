import { Injectable, OnModuleDestroy } from '@nestjs/common'
import type { DomainEvent } from './events'
import type { EventHandler, EventTransport } from './transport'

@Injectable()
export class EventBus implements OnModuleDestroy {
  constructor(private readonly transport: EventTransport) {}

  publish(event: DomainEvent): Promise<void> {
    return this.transport.publish(event)
  }

  subscribe(type: string, handler: EventHandler): Promise<void> {
    return this.transport.subscribe(type, handler)
  }

  close(): Promise<void> {
    return this.transport.close()
  }

  onModuleDestroy(): Promise<void> {
    return this.close()
  }
}
