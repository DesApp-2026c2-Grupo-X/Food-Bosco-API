import { Injectable } from '@nestjs/common'
import { BranchService } from '../branch/branch.service'
import { ERROR_CODES, ORDER_STATUS } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { PublicOrder } from '../order/order.model'
import { OrderService } from '../order/order.service'
import {
  BranchRatingRow,
  BranchReviewStats,
  CourierRatingRow,
  CourierReviewStats,
  PublicOrderReview,
  ReviewsSummary,
} from './order-review.model'
import { ReviewFilter } from './order-review.repository'
import { OrderReviewService } from './order-review.service'
import { CreateOrderReviewDto } from './dto/create-order-review.dto'

export interface OrderReviewStatus {
  canReview: boolean
  review: PublicOrderReview | null
}

const DEFAULT_RANKING_LIMIT = 10

@Injectable()
export class OrderReviewOrchestrator {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderReviewService: OrderReviewService,
    private readonly branchService: BranchService,
  ) {}

  async create(
    customerId: string,
    orderId: string,
    dto: CreateOrderReviewDto,
  ): Promise<PublicOrderReview> {
    const order = await this.requireOwnOrder(customerId, orderId)

    if (order.status !== ORDER_STATUS.delivered) {
      throw new DomainException(
        ERROR_CODES.orderNotDelivered,
        'Solo podés calificar un pedido que ya fue entregado.',
        409,
      )
    }

    const branch = await this.branchService.findById(order.branchId)
    if (!branch) {
      throw new DomainException(
        ERROR_CODES.invalidReviewBranch,
        'La sucursal del pedido no existe.',
        409,
      )
    }

    this.assertCourierFields(order, dto)

    const existing = await this.orderReviewService.findByOrderId(orderId)
    if (existing) {
      throw new DomainException(
        ERROR_CODES.reviewAlreadyExists,
        'Este pedido ya tiene una reseña.',
        409,
      )
    }

    return this.orderReviewService.create({
      orderId: order.id,
      customerId,
      branchId: order.branchId,
      branchRating: dto.branchRating,
      branchComment: dto.branchComment ?? null,
      courierId: order.riderId,
      courierRating: order.riderId ? (dto.courierRating ?? null) : null,
      courierComment: order.riderId ? (dto.courierComment ?? null) : null,
    })
  }

  async getStatus(customerId: string, orderId: string): Promise<OrderReviewStatus> {
    const order = await this.requireOwnOrder(customerId, orderId)
    const review = await this.orderReviewService.findByOrderId(orderId)

    return {
      canReview: order.status === ORDER_STATUS.delivered && review === null,
      review,
    }
  }

  listMine(customerId: string): Promise<PublicOrderReview[]> {
    return this.orderReviewService.listByCustomer(customerId)
  }

  async listPending(customerId: string): Promise<PublicOrder[]> {
    const { data: delivered } = await this.orderService.list({
      clientId: customerId,
      status: ORDER_STATUS.delivered,
      limit: 100,
      offset: 0,
    })
    const reviews = await this.orderReviewService.listByCustomer(customerId)
    const reviewedOrders = new Set(reviews.map((review) => review.orderId))

    return delivered.filter((order) => !reviewedOrders.has(order.id))
  }

  branchStats(branchId: string, filter: ReviewFilter = {}): Promise<BranchReviewStats> {
    return this.orderReviewService.branchStats(branchId, filter)
  }

  courierStats(courierId: string, filter: ReviewFilter = {}): Promise<CourierReviewStats> {
    return this.orderReviewService.courierStats(courierId, filter)
  }

  branchRanking(
    filter: ReviewFilter = {},
    limit = DEFAULT_RANKING_LIMIT,
  ): Promise<BranchRatingRow[]> {
    return this.orderReviewService.branchRanking(limit, filter)
  }

  courierRanking(
    filter: ReviewFilter = {},
    limit = DEFAULT_RANKING_LIMIT,
  ): Promise<CourierRatingRow[]> {
    return this.orderReviewService.courierRanking(limit, filter)
  }

  summary(filter: ReviewFilter = {}): Promise<ReviewsSummary> {
    return this.orderReviewService.summary(filter)
  }

  private async requireOwnOrder(customerId: string, orderId: string): Promise<PublicOrder> {
    const order = await this.orderService.findById(orderId)

    if (!order) {
      throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado.', 404)
    }

    if (order.clientId !== customerId) {
      throw new DomainException(
        ERROR_CODES.orderNotOwned,
        'No podés calificar un pedido que no te pertenece.',
        403,
      )
    }

    return order
  }

  private assertCourierFields(order: PublicOrder, dto: CreateOrderReviewDto): void {
    const hasCourierFields = dto.courierRating != null || Boolean(dto.courierComment?.trim())

    if (!order.riderId) {
      if (hasCourierFields) {
        throw new DomainException(
          ERROR_CODES.courierNotAssigned,
          'Este pedido no tiene un repartidor asignado.',
          400,
        )
      }
      return
    }

    if (dto.courierRating == null) {
      throw new DomainException(
        ERROR_CODES.courierRatingRequired,
        'Tenés que calificar al repartidor de este pedido.',
        400,
      )
    }
  }
}
