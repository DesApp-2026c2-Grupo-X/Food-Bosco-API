import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Address, AddressSchema } from '../address/address.model'
import { AddressRepository } from '../address/address.repository'
import { AddressService } from '../address/address.service'
import { DatabaseModule } from '../config/database/database.module'
import { User, UserSchema } from '../user/user.model'
import { UserRepository } from '../user/user.repository'
import { UserService } from '../user/user.service'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Address.name, schema: AddressSchema },
    ]),
  ],
  controllers: [SeedController],
  providers: [UserRepository, UserService, AddressRepository, AddressService, SeedService],
})
export class SeedModule {}
