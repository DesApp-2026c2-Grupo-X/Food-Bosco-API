import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ZoneController } from './zone.controller'
import { Zone, ZoneSchema } from './zone.model'
import { ZoneRepository } from './zone.repository'
import { ZoneService } from './zone.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Zone.name, schema: ZoneSchema }])],
  controllers: [ZoneController],
  providers: [ZoneRepository, ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
