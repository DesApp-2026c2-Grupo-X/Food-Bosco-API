import { Injectable } from '@nestjs/common'
import { PublicIngredient, serializeIngredient } from './ingredient.model'
import {
  CreateIngredientData,
  IngredientListQuery,
  IngredientRepository,
  UpdateIngredientData,
} from './ingredient.repository'

export interface IngredientListResponse {
  data: PublicIngredient[]
  meta: { total: number; limit: number; offset: number }
}

@Injectable()
export class IngredientService {
  constructor(private readonly repository: IngredientRepository) {}

  async list(query: IngredientListQuery): Promise<IngredientListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeIngredient),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicIngredient | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeIngredient(doc) : null
  }

  async create(data: CreateIngredientData): Promise<PublicIngredient> {
    const doc = await this.repository.create(data)
    return serializeIngredient(doc)
  }

  async update(id: string, patch: UpdateIngredientData): Promise<PublicIngredient | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializeIngredient(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicIngredient | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeIngredient(doc) : null
  }
}
