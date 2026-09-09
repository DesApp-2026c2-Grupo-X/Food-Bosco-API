import type { DomainEvent } from './events'

export type EventHandler = (event: DomainEvent) => void | Promise<void>

export interface EventTransport {
  publish(event: DomainEvent): Promise<void>
  subscribe(type: string, handler: EventHandler): Promise<void>
  close(): Promise<void>
}
