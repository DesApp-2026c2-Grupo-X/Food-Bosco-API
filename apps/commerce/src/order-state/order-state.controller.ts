import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Authenticated } from '../config/security/authenticated.decorator'
import { Roles } from '../config/security/roles.decorator'
import type { PublicOrderState } from './order-state.model'
import { OrderStateService } from './order-state.service'
import { CreateOrderStateDto, SetActiveDto, UpdateOrderStateDto } from './dto/order-state.dto'

@Controller('v1/config/order-states')
export class OrderStateController {
  constructor(private readonly orderStateService: OrderStateService) {}

  @Get()
  @Authenticated()
  list(): Promise<PublicOrderState[]> {
    return this.orderStateService.list()
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreateOrderStateDto): Promise<PublicOrderState> {
    return this.orderStateService.create(dto)
  }

  @Put(':code')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('code') code: string,
    @Body() dto: UpdateOrderStateDto,
  ): Promise<PublicOrderState> {
    const state = await this.orderStateService.update(code, dto)
    if (!state) {
      throw new DomainException(ERROR_CODES.orderStateNotFound, 'Estado no encontrado', 404)
    }
    return state
  }

  @Patch(':code/active')
  @Roles(ROLES.superAdmin)
  async setActive(
    @Param('code') code: string,
    @Body() dto: SetActiveDto,
  ): Promise<PublicOrderState> {
    const state = await this.orderStateService.setActive(code, dto.active)
    if (!state) {
      throw new DomainException(ERROR_CODES.orderStateNotFound, 'Estado no encontrado', 404)
    }
    return state
  }
}
