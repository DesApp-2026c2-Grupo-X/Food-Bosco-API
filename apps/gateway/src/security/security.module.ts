import { Module } from '@nestjs/common'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'

@Module({
  providers: [JwtService, RolesGuard],
  exports: [JwtService, RolesGuard],
})
export class SecurityModule {}
