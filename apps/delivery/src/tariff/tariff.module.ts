import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { TariffController } from './tariff.controller'
import { DeliveryTariff, DeliveryTariffSchema } from './tariff.model'
import { TariffRepository } from './tariff.repository'
import { TariffService } from './tariff.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeliveryTariff.name, schema: DeliveryTariffSchema }]),
  ],
  controllers: [TariffController],
  providers: [TariffRepository, TariffService],
  exports: [TariffService],
})
export class TariffModule {}
