import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicOrder } from '../order/order.model'
import { CreateOrderReviewDto } from './dto/create-order-review.dto'
import { ReviewQueryDto } from './dto/review-query.dto'
import {
  BranchRatingRow,
  BranchReviewStats,
  CourierRatingRow,
  CourierReviewStats,
  PublicOrderReview,
  ReviewsSummary,
} from './order-review.model'
import { OrderReviewOrchestrator } from './order-review.orchestrator'
import type { OrderReviewStatus } from './order-review.orchestrator'

@Controller('v1/reviews')
export class OrderReviewController {
  constructor(private readonly orchestrator: OrderReviewOrchestrator) {}

  @Post('orders/:orderId')
  @Roles(ROLES.customer)
  create(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderReviewDto,
  ): Promise<PublicOrderReview> {
    return this.orchestrator.create(auth.userId ?? '', orderId, dto)
  }

  @Get('orders/:orderId')
  @Roles(ROLES.customer)
  status(
    @CurrentUser() auth: AuthContext,
    @Param('orderId') orderId: string,
  ): Promise<OrderReviewStatus> {
    return this.orchestrator.getStatus(auth.userId ?? '', orderId)
  }

  @Get('mine')
  @Roles(ROLES.customer)
  mine(@CurrentUser() auth: AuthContext): Promise<PublicOrderReview[]> {
    return this.orchestrator.listMine(auth.userId ?? '')
  }

  @Get('pending')
  @Roles(ROLES.customer)
  pending(@CurrentUser() auth: AuthContext): Promise<PublicOrder[]> {
    return this.orchestrator.listPending(auth.userId ?? '')
  }

  @Get('branches/ranking')
  @Roles(ROLES.superAdmin)
  branchRanking(@Query() query: ReviewQueryDto): Promise<BranchRatingRow[]> {
    return this.orchestrator.branchRanking(this.toFilter(query), query.limit)
  }

  @Get('couriers/ranking')
  @Roles(ROLES.superAdmin)
  courierRanking(@Query() query: ReviewQueryDto): Promise<CourierRatingRow[]> {
    return this.orchestrator.courierRanking(this.toFilter(query), query.limit)
  }

  @Get('summary')
  @Roles(ROLES.superAdmin)
  summary(@Query() query: ReviewQueryDto): Promise<ReviewsSummary> {
    return this.orchestrator.summary(this.toFilter(query))
  }

  @Get('branches/:branchId/stats')
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  branchStats(
    @CurrentUser() auth: AuthContext,
    @Param('branchId') branchId: string,
    @Query() query: ReviewQueryDto,
  ): Promise<BranchReviewStats> {
    return this.orchestrator.branchStats(this.resolveBranchId(auth, branchId), this.toFilter(query))
  }

  @Get('couriers/:courierId/stats')
  @Roles(ROLES.rider, ROLES.superAdmin)
  courierStats(
    @CurrentUser() auth: AuthContext,
    @Param('courierId') courierId: string,
    @Query() query: ReviewQueryDto,
  ): Promise<CourierReviewStats> {
    return this.orchestrator.courierStats(
      this.resolveCourierId(auth, courierId),
      this.toFilter(query),
    )
  }

  private resolveBranchId(auth: AuthContext, branchId: string): string {
    if (auth.roles.includes(ROLES.superAdmin)) {
      return branchId
    }
    if (!auth.branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin sucursal asignada.', 403)
    }
    if (auth.branchId !== branchId) {
      throw new DomainException(
        ERROR_CODES.forbidden,
        'Solo podés consultar las calificaciones de tu sucursal.',
        403,
      )
    }
    return auth.branchId
  }

  private resolveCourierId(auth: AuthContext, courierId: string): string {
    if (auth.roles.includes(ROLES.superAdmin)) {
      return courierId
    }
    if (!auth.userId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Identidad no resoluble.', 403)
    }
    if (auth.userId !== courierId) {
      throw new DomainException(
        ERROR_CODES.forbidden,
        'Solo podés consultar tu propia reputación.',
        403,
      )
    }
    return auth.userId
  }

  private toFilter(query: ReviewQueryDto): { from?: string; to?: string; limit?: number } {
    return { from: query.from, to: query.to, limit: query.limit }
  }
}
