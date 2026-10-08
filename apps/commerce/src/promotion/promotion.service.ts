import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicPromotion, serializePromotion } from './promotion.model'
import {
  CreatePromotionData,
  PromotionListQuery,
  PromotionRepository,
  UpdatePromotionData,
} from './promotion.repository'

export interface PromotionListResponse {
  data: PublicPromotion[]
  meta: { total: number; limit: number; offset: number }
}

const assertDateRange = (startDate: Date, endDate: Date): void => {
  if (startDate.getTime() > endDate.getTime()) {
    throw new DomainException(
      ERROR_CODES.validationError,
      'La fecha de inicio no puede ser posterior a la fecha de fin',
      400,
    )
  }
}

@Injectable()
export class PromotionService {
  constructor(private readonly repository: PromotionRepository) {}

  async list(query: PromotionListQuery): Promise<PromotionListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializePromotion),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicPromotion | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializePromotion(doc) : null
  }

  async create(data: CreatePromotionData): Promise<PublicPromotion> {
    assertDateRange(data.startDate, data.endDate)
    const doc = await this.repository.create(data)
    return serializePromotion(doc)
  }

  async upsertByName(data: CreatePromotionData): Promise<PublicPromotion> {
    const doc = await this.repository.upsertByName(data)
    return serializePromotion(doc!)
  }

  async update(id: string, patch: UpdatePromotionData): Promise<PublicPromotion | null> {
    if (patch.startDate !== undefined || patch.endDate !== undefined) {
      const current = await this.repository.findById(id)
      if (!current) return null
      assertDateRange(patch.startDate ?? current.startDate, patch.endDate ?? current.endDate)
    }
    const doc = await this.repository.update(id, patch)
    return doc ? serializePromotion(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicPromotion | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializePromotion(doc) : null
  }
}
