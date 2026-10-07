import { Module } from '@nestjs/common'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'
import { AuthGuard } from './auth.guard'
import { InternalGuard } from './internal.guard'

@Module({
  providers: [JwtService, RolesGuard, AuthGuard, InternalGuard],
  exports: [JwtService, RolesGuard, AuthGuard, InternalGuard],
})
export class SecurityModule {}
