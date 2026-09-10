import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Internal } from '../config/security/internal.decorator'
import type { PublicShift } from './shift.model'
import { ShiftService } from './shift.service'
import { CreateShiftDto, SetActiveDto } from './dto/shift.dto'

@Controller('v1/shifts')
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Get()
  list(): Promise<PublicShift[]> {
    return this.shiftService.list()
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PublicShift> {
    const shift = await this.shiftService.findById(id)
    if (!shift) {
      throw new DomainException(ERROR_CODES.shiftNotFound, 'Turno de rider no encontrado', 404)
    }
    return shift
  }

  @Post()
  @Internal()
  create(@Body() dto: CreateShiftDto): Promise<PublicShift> {
    return this.shiftService.create(dto)
  }

  @Patch(':id/active')
  @Internal()
  async setActive(@Param('id') id: string, @Body() dto: SetActiveDto): Promise<PublicShift> {
    const shift = await this.shiftService.setActive(id, dto.active)
    if (!shift) {
      throw new DomainException(ERROR_CODES.shiftNotFound, 'Turno de rider no encontrado', 404)
    }
    return shift
  }
}
