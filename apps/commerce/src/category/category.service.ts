import { Injectable } from '@nestjs/common'
import { PublicCategory, serializeCategory } from './category.model'
import {
  CategoryListQuery,
  CategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from './category.repository'

export interface CategoryListResponse {
  data: PublicCategory[]
  meta: { total: number; limit: number; offset: number }
}

@Injectable()
export class CategoryService {
  constructor(private readonly repository: CategoryRepository) {}

  async list(query: CategoryListQuery): Promise<CategoryListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeCategory),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicCategory | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeCategory(doc) : null
  }

  async create(data: CreateCategoryData): Promise<PublicCategory> {
    const doc = await this.repository.create(data)
    return serializeCategory(doc)
  }

  async update(id: string, patch: UpdateCategoryData): Promise<PublicCategory | null> {
    const doc = await this.repository.update(id, patch)
    return doc ? serializeCategory(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicCategory | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializeCategory(doc) : null
  }
}
