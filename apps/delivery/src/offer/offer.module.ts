import { Module } from '@nestjs/common'
import { HttpModule } from '../config/http/http.module'
import { MessagingModule } from '../config/messaging/messaging.module'
import { DeliveryOrderModule } from '../delivery-order/delivery-order.module'
import { RiderModule } from '../rider/rider.module'
import { TripModule } from '../trip/trip.module'
import { OfferController } from './offer.controller'
import { OfferOrchestrator } from './offer.orchestrator'

@Module({
  imports: [RiderModule, TripModule, DeliveryOrderModule, HttpModule, MessagingModule],
  controllers: [OfferController],
  providers: [OfferOrchestrator],
})
export class OfferModule {}
