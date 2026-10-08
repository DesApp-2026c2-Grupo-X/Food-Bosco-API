import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { isDuplicateKeyError } from '../config/database/is-duplicate-key-error'
import { DomainException } from '../config/exceptions/domain.exception'
import { Promotion, PromotionDocument, PROMOTION_ALREADY_EXISTS } from './promotion.model'

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

  async create(data: CreatePromotionData): Promise<PromotionDocument> {
    try {
      return await this.model.create({ ...data, active: true })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainException(
          PROMOTION_ALREADY_EXISTS,
          'Ya existe una promoción con ese nombre',
          409,
        )
      }
      throw error
    }
  }

  upsertByName(data: CreatePromotionData): Promise<PromotionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { name: data.name },
        { $setOnInsert: { ...data, active: true } },
        { new: true, upsert: true },
      )
      .exec()
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

  async update(id: string, patch: UpdatePromotionData): Promise<PromotionDocument | null> {
    try {
      return await this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainException(
          PROMOTION_ALREADY_EXISTS,
          'Ya existe una promoción con ese nombre',
          409,
        )
      }
      throw error
    }
  }

  setActive(id: string, active: boolean): Promise<PromotionDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
