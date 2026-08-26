import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { HttpModule } from '../config/http/http.module'
import { RiderController } from './rider.controller'
import { Rider, RiderSchema } from './rider.model'
import { RiderOrchestrator } from './rider.orchestrator'
import { RiderRepository } from './rider.repository'
import { RiderService } from './rider.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Rider.name, schema: RiderSchema }]), HttpModule],
  controllers: [RiderController],
  providers: [RiderRepository, RiderService, RiderOrchestrator],
  exports: [RiderService, RiderOrchestrator],
})
export class RiderModule {}
