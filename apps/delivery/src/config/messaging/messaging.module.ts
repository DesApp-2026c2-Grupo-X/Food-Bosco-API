import { Module } from '@nestjs/common'
import { env } from '../env'
import { EventBus } from './event-bus'
import { InProcessTransport } from './in-process.transport'
import { RabbitTransport } from './rabbit.transport'

@Module({
  providers: [
    {
      provide: EventBus,
      useFactory: (): EventBus =>
        new EventBus(env.brokerUrl ? new RabbitTransport(env.brokerUrl) : new InProcessTransport()),
    },
  ],
  exports: [EventBus],
})
export class MessagingModule {}
