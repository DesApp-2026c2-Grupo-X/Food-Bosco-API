import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { ERROR_CODES, PromotionScope, PromotionType } from '../config/constants'
import { isDuplicateKeyError } from '../config/database/is-duplicate-key-error'
import { DomainException } from '../config/exceptions/domain.exception'
import { Promotion, PromotionDocument, PROMOTION_ALREADY_EXISTS } from './promotion.model'

export interface CreatePromotionData {
  name: string
  description?: string | null
  startDate: Date
  endDate: Date
  active?: boolean
  type?: PromotionType | null
  discountValue?: number | null
  maxDiscount?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  scope?: PromotionScope | null
  categoryIds?: string[]
  productIds?: string[]
  branchIds?: string[]
  minSubtotal?: number
  minQuantity?: number
  daysOfWeek?: number[]
  startTime?: string | null
  endTime?: string | null
  code?: string | null
  stackable?: boolean
  priority?: number
  maxUsesTotal?: number | null
  maxUsesPerCustomer?: number | null
}

export interface UpdatePromotionData {
  name?: string
  description?: string | null
  startDate?: Date
  endDate?: Date
  active?: boolean
  type?: PromotionType | null
  discountValue?: number | null
  maxDiscount?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  scope?: PromotionScope | null
  categoryIds?: string[]
  productIds?: string[]
  branchIds?: string[]
  minSubtotal?: number
  minQuantity?: number
  daysOfWeek?: number[]
  startTime?: string | null
  endTime?: string | null
  code?: string | null
  stackable?: boolean
  priority?: number
  maxUsesTotal?: number | null
  maxUsesPerCustomer?: number | null
}

export interface PromotionListQuery {
  activeOnly?: boolean
  type?: PromotionType
  scope?: PromotionScope
  code?: string
  branchId?: string
  search?: string
  limit: number
  offset: number
}

export interface CandidateQuery {
  branchId?: string | null
  now?: Date
  code?: string | null
}

@Injectable()
export class PromotionRepository {
  constructor(@InjectModel(Promotion.name) private readonly model: Model<PromotionDocument>) {}

  findById(id: string): Promise<PromotionDocument | null> {
    return this.model.findById(id).exec()
  }

  findByCode(code: string): Promise<PromotionDocument | null> {
    const norm = code.trim().toUpperCase()
    return this.model.findOne({ code: norm }).exec()
  }

  private handleDuplicateError(error: unknown): never {
    if (isDuplicateKeyError(error)) {
      const msg = String(error)
      if (
        msg.includes('code') ||
        (typeof error === 'object' &&
          error !== null &&
          'keyPattern' in error &&
          (error as { keyPattern: Record<string, unknown> }).keyPattern?.code)
      ) {
        throw new DomainException(
          ERROR_CODES.promotionCodeAlreadyExists,
          'Ya existe una promoción con ese código de cupón',
          409,
        )
      }
      throw new DomainException(
        PROMOTION_ALREADY_EXISTS,
        'Ya existe una promoción con ese nombre',
        409,
      )
    }
    throw error
  }

  async create(data: CreatePromotionData): Promise<PromotionDocument> {
    try {
      const active = data.active !== undefined ? data.active : true
      const payload: Record<string, unknown> = { ...data, active }
      if (data.code !== undefined) {
        payload.code = data.code ? data.code.trim().toUpperCase() : null
      }
      return await this.model.create(payload)
    } catch (error) {
      this.handleDuplicateError(error)
    }
  }

  upsertByName(data: CreatePromotionData): Promise<PromotionDocument | null> {
    const code = data.code ? data.code.trim().toUpperCase() : null
    return this.model
      .findOneAndUpdate(
        { name: data.name },
        { $setOnInsert: { ...data, code, active: data.active !== undefined ? data.active : true } },
        { new: true, upsert: true },
      )
      .exec()
  }

  async list(query: PromotionListQuery): Promise<{ data: PromotionDocument[]; total: number }> {
    const filter: FilterQuery<PromotionDocument> = {}
    if (query.activeOnly) filter.active = true
    if (query.type) filter.type = query.type
    if (query.scope) filter.scope = query.scope
    if (query.code) filter.code = query.code.trim().toUpperCase()
    if (query.branchId) filter.branchIds = query.branchId
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
        { code: { $regex: query.search.trim(), $options: 'i' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  async findActiveCandidates(params: CandidateQuery = {}): Promise<PromotionDocument[]> {
    const now = params.now ?? new Date()
    const filter: FilterQuery<PromotionDocument> = {
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      type: { $ne: null },
    }

    const andConditions: FilterQuery<PromotionDocument>[] = []

    if (params.branchId) {
      andConditions.push({
        $or: [{ branchIds: { $size: 0 } }, { branchIds: params.branchId }],
      })
    }

    const reqCode = params.code ? params.code.trim().toUpperCase() : null
    if (reqCode) {
      andConditions.push({
        $or: [{ code: null }, { code: '' }, { code: reqCode }],
      })
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions
    }

    return this.model.find(filter).sort({ priority: -1, createdAt: -1 }).exec()
  }

  async findPublicActive(now: Date = new Date()): Promise<PromotionDocument[]> {
    return this.model
      .find({
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .sort({ priority: -1, createdAt: -1 })
      .exec()
  }

  async update(id: string, patch: UpdatePromotionData): Promise<PromotionDocument | null> {
    try {
      const updateData: Record<string, unknown> = { ...patch }
      if (patch.code !== undefined) {
        updateData.code = patch.code ? patch.code.trim().toUpperCase() : null
      }
      return await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true }).exec()
    } catch (error) {
      this.handleDuplicateError(error)
    }
  }

  setActive(id: string, active: boolean): Promise<PromotionDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }

  async incrementUsedCount(id: string, delta: number = 1): Promise<void> {
    await this.model.findByIdAndUpdate(id, { $inc: { usedCount: delta } }).exec()
  }

  async delete(id: string): Promise<PromotionDocument | null> {
    return this.model.findByIdAndDelete(id).exec()
  }

  async decrementUsedCount(id: string, delta: number = 1): Promise<void> {
    await this.model.findByIdAndUpdate(id, { $inc: { usedCount: -delta } }).exec()
  }
}
