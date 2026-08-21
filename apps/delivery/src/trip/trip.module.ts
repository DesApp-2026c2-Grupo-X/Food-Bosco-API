import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Trip, TripSchema } from './trip.model'
import { TripRepository } from './trip.repository'
import { TripService } from './trip.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Trip.name, schema: TripSchema }])],
  providers: [TripRepository, TripService],
  exports: [TripService],
})
export class TripModule {}
