import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { Authenticated } from '../config/security/authenticated.decorator'
import { Internal } from '../config/security/internal.decorator'
import type { PublicOrder, PublicOrderStatusHistory } from './order.model'
import { OrderOrchestrator } from './order.orchestrator'
import type { RepeatOrderResult } from './order.orchestrator'
import { OrderService } from './order.service'
import type { OrderListResponse } from './order.service'
import { ChangeStatusDto } from './dto/change-status.dto'
import { CreateOrderDto } from './dto/create-order.dto'
import { OrderQueryDto } from './dto/order-query.dto'

@Controller('v1/orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orchestrator: OrderOrchestrator,
  ) {}

  @Get()
  @Authenticated()
  list(
    @CurrentUser() auth: AuthContext,
    @Query() query: OrderQueryDto,
  ): Promise<OrderListResponse> {
    const isBranchAdmin = auth.roles.includes(ROLES.branchAdmin)
    const branchId = isBranchAdmin ? (auth.branchId ?? '') : query.branchId
    if (isBranchAdmin && !branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin sucursal asignada', 403)
    }

    return this.orderService.list({
      clientId: auth.roles.includes(ROLES.customer) ? (auth.userId ?? undefined) : undefined,
      branchId: branchId || undefined,
      status: query.status,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.customer)
  create(
    @CurrentUser() auth: AuthContext,
    @Body() dto: CreateOrderDto,
  ): Promise<PublicOrder> {
    return this.orchestrator.create(auth.userId ?? '', dto)
  }

  @Get(':orderId')
  @Authenticated()
  async get(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
  ): Promise<PublicOrder> {
    const order = await this.orderService.findById(orderId)
    this.assertCanView(auth, order)
    return order
  }

  @Get(':orderId/history')
  @Authenticated()
  async history(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
  ): Promise<PublicOrderStatusHistory[]> {
    const order = await this.orderService.findById(orderId)
    this.assertCanView(auth, order)
    return order.statusHistory
  }

  @Get(':orderId/transitions')
  @Authenticated()
  async transitions(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
  ): Promise<string[]> {
    const order = await this.orderService.findById(orderId)
    this.assertCanView(auth, order)
    return order.availableTransitions
  }

  @Patch(':orderId/status')
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  @Internal()
  changeStatus(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<PublicOrder> {
    return this.orchestrator.changeStatus(auth, orderId, dto.status)
  }

  @Post(':orderId/repeat')
  @Roles(ROLES.customer)
  repeat(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
  ): Promise<RepeatOrderResult> {
    return this.orchestrator.repeat(auth.userId ?? '', orderId)
  }

  private assertCanView(auth: AuthContext, order: PublicOrder | null): asserts order is PublicOrder {
    if (!order) {
      throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404)
    }
    if (auth.roles.includes(ROLES.superAdmin)) {
      return
    }
    if (auth.roles.includes(ROLES.branchAdmin) && auth.branchId === order.branchId) {
      return
    }
    if (auth.userId === order.clientId) {
      return
    }
    throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404)
  }
}
