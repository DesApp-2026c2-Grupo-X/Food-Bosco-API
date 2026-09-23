import { Module } from '@nestjs/common'
import { SecurityModule } from '../config/security/security.module'
import { EmailModule } from '../email/email.module'
import { PasswordRecoveryModule } from '../password-recovery/password-recovery.module'
import { RefreshTokenModule } from '../refresh-token/refresh-token.module'
import { UserModule } from '../user/user.module'
import { AuthController } from './auth.controller'
import { AuthOrchestrator } from './auth.orchestrator'

@Module({
  imports: [UserModule, RefreshTokenModule, PasswordRecoveryModule, SecurityModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthOrchestrator],
})
export class AuthModule {}
