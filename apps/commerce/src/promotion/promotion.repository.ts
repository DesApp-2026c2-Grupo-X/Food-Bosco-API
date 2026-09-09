import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Promotion, PromotionDocument } from './promotion.model'

export interface CreatePromotionData {
  name: string
  description?: string
  startDate: Date
  endDate: Date
}

export interface UpdatePromotionData {
  name?: string
  description?: string
  startDate?: Date
  endDate?: Date
}

export interface PromotionListQuery {
  activeOnly?: boolean
  limit: number
  offset: number
}

@Injectable()
export class PromotionRepository {
  constructor(@InjectModel(Promotion.name) private readonly model: Model<PromotionDocument>) {}

  findById(id: string): Promise<PromotionDocument | null> {
    return this.model.findById(id).exec()
  }

  create(data: CreatePromotionData): Promise<PromotionDocument> {
    return this.model.create({ ...data, active: true })
  }

  async list(query: PromotionListQuery): Promise<{ data: PromotionDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.activeOnly) filter.active = true

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdatePromotionData): Promise<PromotionDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<PromotionDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
