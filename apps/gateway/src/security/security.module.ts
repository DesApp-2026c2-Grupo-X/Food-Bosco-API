import { Module } from '@nestjs/common'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'
import { AuthGuard } from './auth.guard'

@Module({
  providers: [JwtService, RolesGuard, AuthGuard],
  exports: [JwtService, RolesGuard, AuthGuard],
})
export class SecurityModule {}
