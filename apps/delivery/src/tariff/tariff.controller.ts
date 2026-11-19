import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import { Internal } from '../config/security/internal.decorator'
import { TariffHistoryQueryDto, PublishTariffDto } from './dto/tariff.dto'
import type { PublicDeliveryTariff } from './tariff.model'
import { TariffService } from './tariff.service'

@Controller('v1/tariffs')
export class TariffController {
  constructor(private readonly tariffService: TariffService) {}

  @Get('active')
  @Internal()
  getActive(): Promise<PublicDeliveryTariff> {
    return this.tariffService.getActive()
  }

  @Get()
  @Internal()
  list(@Query() query: TariffHistoryQueryDto): Promise<PublicDeliveryTariff[]> {
    return this.tariffService.listHistory(query.limit ?? 20)
  }

  @Post()
  @Internal()
  publish(@Body() dto: PublishTariffDto): Promise<PublicDeliveryTariff> {
    return this.tariffService.publish(dto)
  }
}
