import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { DatabaseModule } from './config/database/database.module'
import { SecurityModule } from './config/security/security.module'
import { RequestIdMiddleware } from './config/observability/request-id.middleware'
import { HealthModule } from './health/health.module'
import { DeliveryOrderModule } from './delivery-order/delivery-order.module'
import { OfferModule } from './offer/offer.module'
import { RiderModule } from './rider/rider.module'
import { SeedModule } from './seed/seed.module'
import { ShiftModule } from './shift/shift.module'
import { TripModule } from './trip/trip.module'
import { ZoneModule } from './zone/zone.module'

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    HealthModule,
    RiderModule,
    DeliveryOrderModule,
    OfferModule,
    TripModule,
    ZoneModule,
    ShiftModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
