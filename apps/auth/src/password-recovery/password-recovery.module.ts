import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PasswordRecovery, PasswordRecoverySchema } from './password-recovery.model'
import { PasswordRecoveryRepository } from './password-recovery.repository'
import { PasswordRecoveryService } from './password-recovery.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PasswordRecovery.name, schema: PasswordRecoverySchema }]),
  ],
  providers: [PasswordRecoveryRepository, PasswordRecoveryService],
  exports: [PasswordRecoveryService],
})
export class PasswordRecoveryModule {}
