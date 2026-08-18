import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { env } from '../config/env'
import { GatewayThrottlerGuard } from './throttle.guard'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: env.throttle.ttlMs,
        limit: env.throttle.limit,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: GatewayThrottlerGuard }],
})
export class ThrottleModule {}
