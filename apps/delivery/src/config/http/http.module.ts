import { Module } from '@nestjs/common'
import { AuthClient } from './auth.client'
import { CommerceClient } from './commerce.client'

@Module({
  providers: [AuthClient, CommerceClient],
  exports: [AuthClient, CommerceClient],
})
export class HttpModule {}
