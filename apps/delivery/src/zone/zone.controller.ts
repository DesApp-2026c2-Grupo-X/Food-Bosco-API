import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Internal } from '../config/security/internal.decorator'
import type { PublicZone } from './zone.model'
import { ZoneService } from './zone.service'
import { CreateZoneDto, SetActiveDto } from './dto/zone.dto'

@Controller('v1/zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Get()
  list(): Promise<PublicZone[]> {
    return this.zoneService.list()
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PublicZone> {
    const zone = await this.zoneService.findById(id)
    if (!zone) {
      throw new DomainException(ERROR_CODES.zoneNotFound, 'Zona de delivery no encontrada', 404)
    }
    return zone
  }

  @Post()
  @Internal()
  create(@Body() dto: CreateZoneDto): Promise<PublicZone> {
    return this.zoneService.create(dto)
  }

  @Patch(':id/active')
  @Internal()
  async setActive(@Param('id') id: string, @Body() dto: SetActiveDto): Promise<PublicZone> {
    const zone = await this.zoneService.setActive(id, dto.active)
    if (!zone) {
      throw new DomainException(ERROR_CODES.zoneNotFound, 'Zona de delivery no encontrada', 404)
    }
    return zone
  }
}
