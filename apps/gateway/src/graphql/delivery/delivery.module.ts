import { Module } from '@nestjs/common'
import { RestModule } from '../../rest/rest.module'
import { DeliveryResolver } from './delivery.resolver'

@Module({
  imports: [RestModule],
  providers: [DeliveryResolver],
})
export class DeliveryGraphqlModule {}
