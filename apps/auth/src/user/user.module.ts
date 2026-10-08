import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CommerceClient } from '../config/http/commerce.client'
import { MeController } from './me.controller'
import { StaffOrchestrator } from './staff.orchestrator'
import { UserController } from './user.controller'
import { User, UserSchema } from './user.model'
import { UserRepository } from './user.repository'
import { UserService } from './user.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UserController, MeController],
  providers: [UserRepository, UserService, CommerceClient, StaffOrchestrator],
  exports: [UserService],
})
export class UserModule {}
