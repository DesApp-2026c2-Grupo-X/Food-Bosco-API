import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Category, CategoryDocument } from './category.model'

export interface CreateCategoryData {
  name: string
}

export interface UpdateCategoryData {
  name?: string
}

export interface CategoryListQuery {
  activeOnly?: boolean
  search?: string
  limit: number
  offset: number
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class CategoryRepository {
  constructor(@InjectModel(Category.name) private readonly model: Model<CategoryDocument>) {}

  findById(id: string): Promise<CategoryDocument | null> {
    return this.model.findById(id).exec()
  }

  findByIds(ids: string[]): Promise<CategoryDocument[]> {
    return this.model.find({ _id: { $in: ids } }).exec()
  }

  create(data: CreateCategoryData): Promise<CategoryDocument> {
    return this.model.create({ ...data, active: true })
  }

  async list(query: CategoryListQuery): Promise<{ data: CategoryDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.activeOnly) filter.active = true
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i')

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdateCategoryData): Promise<CategoryDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<CategoryDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
