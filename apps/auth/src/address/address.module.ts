import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AddressController } from './address.controller'
import { Address, AddressSchema } from './address.model'
import { AddressRepository } from './address.repository'
import { AddressService } from './address.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Address.name, schema: AddressSchema }])],
  controllers: [AddressController],
  providers: [AddressRepository, AddressService],
})
export class AddressModule {}
