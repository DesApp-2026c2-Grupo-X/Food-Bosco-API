import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { PROMOTION_REDEMPTION_STATUS } from '../config/constants'
import { PromotionRedemption, PromotionRedemptionDocument } from './promotion-redemption.model'

export interface CreateRedemptionData {
  promotionId: string
  orderId: string
  clientId: string
  code: string | null
  amount: number
}

@Injectable()
export class PromotionRedemptionRepository {
  constructor(
    @InjectModel(PromotionRedemption.name)
    private readonly redemptionModel: Model<PromotionRedemptionDocument>,
  ) {}

  async createMany(entries: CreateRedemptionData[]): Promise<PromotionRedemptionDocument[]> {
    if (entries.length === 0) return []
    const docs = entries.map((e) => ({
      ...e,
      status: PROMOTION_REDEMPTION_STATUS.active,
      releasedAt: null,
    }))
    return this.redemptionModel.insertMany(docs)
  }

  async releaseByOrder(orderId: string): Promise<PromotionRedemptionDocument[]> {
    const active = await this.redemptionModel.find({
      orderId,
      status: PROMOTION_REDEMPTION_STATUS.active,
    })
    if (active.length === 0) return []

    const releasedAt = new Date()
    await this.redemptionModel.updateMany(
      { orderId, status: PROMOTION_REDEMPTION_STATUS.active },
      { $set: { status: PROMOTION_REDEMPTION_STATUS.released, releasedAt } },
    )

    return active
  }

  async countByPromotion(promotionId: string): Promise<number> {
    return this.redemptionModel.countDocuments({
      promotionId,
      status: PROMOTION_REDEMPTION_STATUS.active,
    })
  }

  async countByPromotionAndClient(promotionId: string, clientId: string): Promise<number> {
    return this.redemptionModel.countDocuments({
      promotionId,
      clientId,
      status: PROMOTION_REDEMPTION_STATUS.active,
    })
  }

  async findByOrder(orderId: string): Promise<PromotionRedemptionDocument[]> {
    return this.redemptionModel.find({ orderId }).exec()
  }

  async getUsageMap(
    promotionIds: string[],
    clientId: string,
  ): Promise<Map<string, { total: number; byCustomer: number }>> {
    const map = new Map<string, { total: number; byCustomer: number }>()
    if (promotionIds.length === 0) return map

    for (const id of promotionIds) {
      map.set(id, { total: 0, byCustomer: 0 })
    }

    const aggregated = await this.redemptionModel.aggregate<{
      _id: string
      total: number
      byCustomer: number
    }>([
      {
        $match: {
          promotionId: { $in: promotionIds },
          status: PROMOTION_REDEMPTION_STATUS.active,
        },
      },
      {
        $group: {
          _id: '$promotionId',
          total: { $sum: 1 },
          byCustomer: {
            $sum: {
              $cond: [{ $eq: ['$clientId', clientId] }, 1, 0],
            },
          },
        },
      },
    ])

    for (const row of aggregated) {
      map.set(row._id, { total: row.total, byCustomer: row.byCustomer })
    }

    return map
  }
}
