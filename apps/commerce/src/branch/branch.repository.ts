import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Branch, BranchDocument, BranchHours } from './branch.model'
import {
  BranchProductAvailability,
  BranchProductAvailabilityDocument,
} from './branch-product-availability.model'

export interface CreateBranchData {
  name: string
  addressText: string
  latitude: number
  longitude: number
  phone?: string
}

export interface UpdateBranchData {
  name?: string
  addressText?: string
  latitude?: number
  longitude?: number
  phone?: string
}

export interface BranchListQuery {
  active?: boolean
  search?: string
  limit: number
  offset: number
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class BranchRepository {
  constructor(
    @InjectModel(Branch.name) private readonly model: Model<BranchDocument>,
    @InjectModel(BranchProductAvailability.name)
    private readonly availabilityModel: Model<BranchProductAvailabilityDocument>,
  ) {}

  findById(id: string): Promise<BranchDocument | null> {
    return this.model.findById(id).exec()
  }

  findActive(): Promise<BranchDocument[]> {
    return this.model.find({ active: true }).exec()
  }

  create(data: CreateBranchData): Promise<BranchDocument> {
    return this.model.create({ ...data, phone: data.phone ?? null, active: true, hours: [] })
  }

  async list(query: BranchListQuery): Promise<{ data: BranchDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.active !== undefined) filter.active = query.active
    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), 'i')
      filter.$or = [{ name: regex }, { addressText: regex }]
    }

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  update(id: string, patch: UpdateBranchData): Promise<BranchDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<BranchDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }

  updateHours(id: string, hours: BranchHours[]): Promise<BranchDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { hours } }, { new: true }).exec()
  }

  listAvailability(branchId: string): Promise<BranchProductAvailabilityDocument[]> {
    return this.availabilityModel.find({ branchId }).exec()
  }

  async upsertAvailability(branchId: string, productId: string, available: boolean): Promise<void> {
    await this.availabilityModel
      .findOneAndUpdate(
        { branchId, productId },
        { $set: { available } },
        { new: true, upsert: true },
      )
      .exec()
  }
}
