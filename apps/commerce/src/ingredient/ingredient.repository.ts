import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Ingredient, IngredientDocument } from './ingredient.model'

export interface CreateIngredientData {
  name: string
  unit: string
}

export interface UpdateIngredientData {
  name?: string
  unit?: string
}

export interface IngredientListQuery {
  activeOnly?: boolean
  search?: string
  limit: number
  offset: number
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class IngredientRepository {
  constructor(@InjectModel(Ingredient.name) private readonly model: Model<IngredientDocument>) {}

  findById(id: string): Promise<IngredientDocument | null> {
    return this.model.findById(id).exec()
  }

  findByIds(ids: string[]): Promise<IngredientDocument[]> {
    return this.model.find({ _id: { $in: ids } }).exec()
  }

  create(data: CreateIngredientData): Promise<IngredientDocument> {
    return this.model.create({ ...data, active: true })
  }

  async list(query: IngredientListQuery): Promise<{ data: IngredientDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.activeOnly) filter.active = true
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i')

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdateIngredientData): Promise<IngredientDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<IngredientDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
