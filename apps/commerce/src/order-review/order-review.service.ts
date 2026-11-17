import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import {
  BranchRatingRow,
  BranchReviewStats,
  CourierRatingRow,
  CourierReviewStats,
  OrderReviewDocument,
  PublicOrderReview,
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  ReviewsSummary,
  serializeOrderReview,
} from './order-review.model'
import {
  CreateOrderReviewData,
  OrderReviewRepository,
  ReviewFilter,
} from './order-review.repository'

const DUPLICATE_KEY_CODE = 11000

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === DUPLICATE_KEY_CODE

const normalizeComment = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const assertRating = (rating: number | null, field: string): void => {
  if (rating === null) return

  if (!Number.isInteger(rating) || rating < REVIEW_MIN_RATING || rating > REVIEW_MAX_RATING) {
    throw new DomainException(
      ERROR_CODES.invalidReviewRating,
      `${field} debe ser un número entero entre ${REVIEW_MIN_RATING} y ${REVIEW_MAX_RATING}.`,
      400,
    )
  }
}

const assertCommentLength = (comment: string | null, field: string): void => {
  if (comment && comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    throw new DomainException(
      ERROR_CODES.validationError,
      `${field} no puede superar los ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`,
      400,
    )
  }
}

@Injectable()
export class OrderReviewService {
  constructor(private readonly repository: OrderReviewRepository) {}

  async findByOrderId(orderId: string): Promise<PublicOrderReview | null> {
    const doc = await this.repository.findByOrderId(orderId)
    return doc ? serializeOrderReview(doc) : null
  }

  async listByCustomer(customerId: string): Promise<PublicOrderReview[]> {
    const docs = await this.repository.listByCustomer(customerId)
    return docs.map(serializeOrderReview)
  }

  async create(data: CreateOrderReviewData): Promise<PublicOrderReview> {
    assertRating(data.branchRating, 'El puntaje de la sucursal')
    assertRating(data.courierRating, 'El puntaje del repartidor')
    assertCommentLength(data.branchComment, 'El comentario de la sucursal')
    assertCommentLength(data.courierComment, 'El comentario del repartidor')

    const review: CreateOrderReviewData = {
      ...data,
      branchComment: normalizeComment(data.branchComment),
      courierComment: normalizeComment(data.courierComment),
    }

    try {
      const doc = await this.repository.create(review)
      return serializeOrderReview(doc)
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainException(
          ERROR_CODES.reviewAlreadyExists,
          'Este pedido ya tiene una reseña.',
          409,
        )
      }
      throw error
    }
  }

  branchStats(branchId: string, filter: ReviewFilter = {}): Promise<BranchReviewStats> {
    return this.repository.branchStats(branchId, filter)
  }

  courierStats(courierId: string, filter: ReviewFilter = {}): Promise<CourierReviewStats> {
    return this.repository.courierStats(courierId, filter)
  }

  branchRanking(limit: number, filter: ReviewFilter = {}): Promise<BranchRatingRow[]> {
    return this.repository.branchRanking(limit, filter)
  }

  courierRanking(limit: number, filter: ReviewFilter = {}): Promise<CourierRatingRow[]> {
    return this.repository.courierRanking(limit, filter)
  }

  summary(filter: ReviewFilter = {}): Promise<ReviewsSummary> {
    return this.repository.summary(filter)
  }

  async existsForOrder(orderId: string): Promise<boolean> {
    const doc: OrderReviewDocument | null = await this.repository.findByOrderId(orderId)
    return doc != null
  }
}
