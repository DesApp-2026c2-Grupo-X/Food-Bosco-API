import { Module } from '@nestjs/common'
import { DatabaseModule } from '../config/database/database.module'
import { OrderStateModule } from '../order-state/order-state.module'
import { ParameterModule } from '../parameter/parameter.module'
import { SeedService } from './seed.service'

@Module({
  imports: [DatabaseModule, ParameterModule, OrderStateModule],
  providers: [SeedService],
})
export class SeedModule {}
