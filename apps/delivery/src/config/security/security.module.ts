import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtService } from './jwt.service'
import { RolesGuard } from './roles.guard'

@Module({
  providers: [JwtService, { provide: APP_GUARD, useClass: RolesGuard }],
  exports: [JwtService],
})
export class SecurityModule {}
