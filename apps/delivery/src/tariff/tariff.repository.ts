import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { isValidObjectId, Model } from 'mongoose'
import { DeliveryTariff, DeliveryTariffDocument } from './tariff.model'

export interface CreateTariffData {
  baseFare: number
  perKm: number
  perOrder: number
  currency: string
  effectiveFrom: Date
  createdBy: string
}

@Injectable()
export class TariffRepository {
  constructor(
    @InjectModel(DeliveryTariff.name)
    private readonly model: Model<DeliveryTariffDocument>,
  ) {}

  findActive(): Promise<DeliveryTariffDocument | null> {
    return this.model.findOne({ active: true }).exec()
  }

  findHistory(limit: number): Promise<DeliveryTariffDocument[]> {
    return this.model.find().sort({ effectiveFrom: -1 }).limit(limit).exec()
  }

  findById(id: string): Promise<DeliveryTariffDocument | null> {
    if (!isValidObjectId(id)) return Promise.resolve(null)
    return this.model.findById(id).exec()
  }

  insertInactive(data: CreateTariffData): Promise<DeliveryTariffDocument> {
    return this.model.create({ ...data, active: false })
  }

  async deactivateAll(): Promise<number> {
    const result = await this.model.updateMany({ active: true }, { $set: { active: false } }).exec()
    return result.modifiedCount
  }

  async activateById(id: string): Promise<DeliveryTariffDocument | null> {
    if (!isValidObjectId(id)) return null
    const result = await this.model.updateOne({ _id: id }, { $set: { active: true } }).exec()
    if (result.matchedCount === 0) return null
    return this.findById(id)
  }

  countActive(): Promise<number> {
    return this.model.countDocuments({ active: true }).exec()
  }
}
