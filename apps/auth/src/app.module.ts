import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AddressModule } from './address/address.module'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './config/database/database.module'
import { SecurityModule } from './config/security/security.module'
import { RequestIdMiddleware } from './config/observability/request-id.middleware'
import { HealthModule } from './health/health.module'
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module'
import { RefreshTokenModule } from './refresh-token/refresh-token.module'
import { UserModule } from './user/user.module'

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    HealthModule,
    UserModule,
    AuthModule,
    RefreshTokenModule,
    PasswordRecoveryModule,
    AddressModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
