import { Module } from '@nestjs/common'
import { RestModule } from '../../rest/rest.module'
import { AuthResolver } from './auth.resolver'

@Module({
  imports: [RestModule],
  providers: [AuthResolver],
})
export class AuthGraphqlModule {}
