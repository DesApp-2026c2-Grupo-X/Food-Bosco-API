import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Zone, ZoneDocument } from './zone.model'

export interface CreateZoneData {
  name: string
  center: { latitude: number; longitude: number }
  radiusKm: number
}

@Injectable()
export class ZoneRepository {
  constructor(@InjectModel(Zone.name) private readonly model: Model<ZoneDocument>) {}

  findAll(): Promise<ZoneDocument[]> {
    return this.model.find().sort({ name: 1 }).exec()
  }

  findActive(): Promise<ZoneDocument[]> {
    return this.model.find({ active: true }).sort({ name: 1 }).exec()
  }

  findById(id: string): Promise<ZoneDocument | null> {
    return this.model.findById(id).exec()
  }

  findByName(name: string): Promise<ZoneDocument | null> {
    return this.model.findOne({ name }).exec()
  }

  create(data: CreateZoneData): Promise<ZoneDocument> {
    return this.model.create({ ...data, active: true })
  }

  upsertByName(name: string, data: CreateZoneData): Promise<ZoneDocument | null> {
    return this.model.findOneAndUpdate({ name }, { $set: data }, { new: true, upsert: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<ZoneDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
