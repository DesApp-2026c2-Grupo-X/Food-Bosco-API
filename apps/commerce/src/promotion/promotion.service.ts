import { Injectable } from '@nestjs/common'
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
    const doc = await this.repository.create(data)
    return serializePromotion(doc)
  }

  async update(id: string, patch: UpdatePromotionData): Promise<PublicPromotion | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializePromotion(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicPromotion | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializePromotion(doc) : null
  }
}
