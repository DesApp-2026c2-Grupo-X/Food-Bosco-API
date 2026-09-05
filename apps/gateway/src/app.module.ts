import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { GatewayModule } from './gateway/gateway.module'
import { HealthModule } from './health/health.module'
import { SecurityModule } from './security/security.module'
import { SeedModule } from './seed/seed.module'
import { ThrottleModule } from './throttle/throttle.module'
import { RequestIdMiddleware } from './observability/request-id.middleware'

@Module({
  imports: [SecurityModule, GatewayModule, HealthModule, SeedModule, ThrottleModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
