import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { DatabaseModule } from '../config/database/database.module'
import { User, UserSchema } from '../user/user.model'
import { UserRepository } from '../user/user.repository'
import { UserService } from '../user/user.service'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [DatabaseModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [SeedController],
  providers: [UserRepository, UserService, SeedService],
})
export class SeedModule {}
