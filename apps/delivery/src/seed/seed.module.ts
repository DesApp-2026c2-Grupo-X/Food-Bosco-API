import { Module } from '@nestjs/common'
import { DatabaseModule } from '../config/database/database.module'
import { RiderModule } from '../rider/rider.module'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [DatabaseModule, RiderModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
