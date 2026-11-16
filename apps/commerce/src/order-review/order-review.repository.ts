import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, PipelineStage } from 'mongoose'
import {
  BranchRatingRow,
  BranchReviewStats,
  CourierRatingRow,
  CourierReviewStats,
  OrderReview,
  OrderReviewDocument,
  RatingBreakdownEntry,
  ReviewsSummary,
  emptyDistribution,
} from './order-review.model'

export interface CreateOrderReviewData {
  orderId: string
  customerId: string
  branchId: string
  branchRating: number
  branchComment: string | null
  courierId: string | null
  courierRating: number | null
  courierComment: string | null
}

export interface ReviewFilter {
  from?: string
  to?: string
  limit?: number
}

export interface ReviewAggregate {
  averageRating: number
  totalReviews: number
  distribution: RatingBreakdownEntry[]
  comments: Array<{ rating: number; comment: string | null; createdAt: Date }>
}

export interface ReviewAggregateRaw {
  averageRating: number
  totalReviews: number
  distribution: Array<{ _id: number; count: number }>
  comments: Array<{ rating: number; comment: string | null; createdAt: Date }>
}

const DEFAULT_COMMENTS_LIMIT = 50

const buildDateMatch = (filter: ReviewFilter): Record<string, unknown> => {
  if (!filter.from && !filter.to) return {}

  const range: Record<string, Date> = {}
  if (filter.from) range.$gte = new Date(filter.from)
  if (filter.to) range.$lte = new Date(filter.to)

  return { createdAt: range }
}

const normalizeDistribution = (
  raw: Array<{ _id: number; count: number }> = [],
): RatingBreakdownEntry[] => {
  const counts = new Map(raw.map((entry) => [Number(entry._id), entry.count]))
  return emptyDistribution().map((entry) => ({
    rating: entry.rating,
    count: counts.get(entry.rating) ?? 0,
  }))
}

const toReviewAggregate = (raw: ReviewAggregateRaw | undefined): ReviewAggregate => ({
  averageRating: raw?.averageRating ?? 0,
  totalReviews: raw?.totalReviews ?? 0,
  distribution: normalizeDistribution(raw?.distribution),
  comments: (raw?.comments ?? []).map((entry) => ({
    rating: entry.rating,
    comment: entry.comment ?? null,
    createdAt: entry.createdAt,
  })),
})

const statsPipeline = (
  match: Record<string, unknown>,
  ratingField: string,
  commentField: string,
  commentsLimit: number,
): PipelineStage[] => [
  { $match: match },
  {
    $facet: {
      summary: [
        {
          $group: {
            _id: null,
            averageRating: { $avg: `$${ratingField}` },
            totalReviews: { $sum: 1 },
          },
        },
      ],
      distribution: [
        {
          $bucket: {
            groupBy: `$${ratingField}`,
            boundaries: [1, 2, 3, 4, 5, 6],
            default: 'other',
            output: { count: { $sum: 1 } },
          },
        },
      ],
      comments: [
        { $match: { [commentField]: { $nin: [null, ''] } } },
        { $sort: { createdAt: -1 } },
        { $limit: commentsLimit },
        {
          $project: {
            _id: 0,
            rating: `$${ratingField}`,
            comment: `$${commentField}`,
            createdAt: 1,
          },
        },
      ],
    },
  },
  {
    $project: {
      averageRating: { $ifNull: [{ $arrayElemAt: ['$summary.averageRating', 0] }, 0] },
      totalReviews: { $ifNull: [{ $arrayElemAt: ['$summary.totalReviews', 0] }, 0] },
      distribution: 1,
      comments: 1,
    },
  },
]

@Injectable()
export class OrderReviewRepository {
  constructor(
    @InjectModel(OrderReview.name)
    private readonly model: Model<OrderReviewDocument>,
  ) {}

  findByOrderId(orderId: string): Promise<OrderReviewDocument | null> {
    return this.model.findOne({ orderId }).exec()
  }

  listByCustomer(customerId: string): Promise<OrderReviewDocument[]> {
    return this.model.find({ customerId }).sort({ createdAt: -1 }).exec()
  }

  create(data: CreateOrderReviewData): Promise<OrderReviewDocument> {
    return this.model.create(data)
  }

  async branchStats(branchId: string, filter: ReviewFilter = {}): Promise<BranchReviewStats> {
    const match = { branchId, ...buildDateMatch(filter) }
    const rows = await this.model
      .aggregate<ReviewAggregateRaw>(
        statsPipeline(
          match,
          'branchRating',
          'branchComment',
          filter.limit ?? DEFAULT_COMMENTS_LIMIT,
        ),
      )
      .exec()
    const stats = toReviewAggregate(rows[0])

    return {
      branchId,
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      distribution: stats.distribution,
      comments: stats.comments.map((entry) => ({
        rating: entry.rating,
        comment: entry.comment,
        createdAt: entry.createdAt.toISOString(),
      })),
    }
  }

  async courierStats(courierId: string, filter: ReviewFilter = {}): Promise<CourierReviewStats> {
    const match = {
      courierId,
      courierRating: { $ne: null },
      ...buildDateMatch(filter),
    }
    const rows = await this.model
      .aggregate<ReviewAggregateRaw>(
        statsPipeline(
          match,
          'courierRating',
          'courierComment',
          filter.limit ?? DEFAULT_COMMENTS_LIMIT,
        ),
      )
      .exec()
    const stats = toReviewAggregate(rows[0])

    return {
      courierId,
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      distribution: stats.distribution,
      comments: stats.comments.map((entry) => ({
        rating: entry.rating,
        comment: entry.comment,
        createdAt: entry.createdAt.toISOString(),
      })),
    }
  }

  async branchRanking(limit: number, filter: ReviewFilter = {}): Promise<BranchRatingRow[]> {
    const rows = await this.model
      .aggregate<{ _id: string; averageRating: number; totalReviews: number }>([
        { $match: buildDateMatch(filter) },
        {
          $group: {
            _id: '$branchId',
            averageRating: { $avg: '$branchRating' },
            totalReviews: { $sum: 1 },
          },
        },
        { $sort: { averageRating: -1, totalReviews: -1 } },
        { $limit: limit },
      ])
      .exec()

    return rows.map((row) => ({
      branchId: row._id,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
    }))
  }

  async courierRanking(limit: number, filter: ReviewFilter = {}): Promise<CourierRatingRow[]> {
    const rows = await this.model
      .aggregate<{ _id: string; averageRating: number; totalReviews: number }>([
        {
          $match: {
            courierId: { $ne: null },
            courierRating: { $ne: null },
            ...buildDateMatch(filter),
          },
        },
        {
          $group: {
            _id: '$courierId',
            averageRating: { $avg: '$courierRating' },
            totalReviews: { $sum: 1 },
          },
        },
        { $sort: { averageRating: -1, totalReviews: -1 } },
        { $limit: limit },
      ])
      .exec()

    return rows.map((row) => ({
      courierId: row._id,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
    }))
  }

  async summary(filter: ReviewFilter = {}): Promise<ReviewsSummary> {
    const rows = await this.model
      .aggregate<{
        branch: Array<{ averageRating: number; totalReviews: number }>
        courier: Array<{ averageRating: number; totalReviews: number }>
      }>([
        { $match: buildDateMatch(filter) },
        {
          $facet: {
            branch: [
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$branchRating' },
                  totalReviews: { $sum: 1 },
                },
              },
            ],
            courier: [
              { $match: { courierRating: { $ne: null } } },
              {
                $group: {
                  _id: null,
                  averageRating: { $avg: '$courierRating' },
                  totalReviews: { $sum: 1 },
                },
              },
            ],
          },
        },
      ])
      .exec()

    const branch = rows[0]?.branch[0]
    const courier = rows[0]?.courier[0]

    return {
      branchAverageRating: branch?.averageRating ?? 0,
      branchReviews: branch?.totalReviews ?? 0,
      courierAverageRating: courier?.averageRating ?? 0,
      courierReviews: courier?.totalReviews ?? 0,
    }
  }
}
