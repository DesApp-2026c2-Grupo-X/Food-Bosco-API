import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { DatabaseModule } from '../config/database/database.module'
import { DeliveryOrderModule } from '../delivery-order/delivery-order.module'
import { RiderModule } from '../rider/rider.module'
import { ShiftModule } from '../shift/shift.module'
import { TariffModule } from '../tariff/tariff.module'
import { Trip, TripSchema } from '../trip/trip.model'
import { ZoneModule } from '../zone/zone.module'

import { DemoTripsRepository } from './demo-trips.repository'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: Trip.name, schema: TripSchema }]),
    RiderModule,
    ZoneModule,
    ShiftModule,
    DeliveryOrderModule,
    TariffModule,
  ],
  controllers: [SeedController],
  providers: [SeedService, DemoTripsRepository],
})
export class SeedModule {}
