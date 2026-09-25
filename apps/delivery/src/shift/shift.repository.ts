import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Shift, ShiftDocument } from './shift.model'

export interface CreateShiftData {
  name: string
  startTime: string
  endTime: string
}

@Injectable()
export class ShiftRepository {
  constructor(@InjectModel(Shift.name) private readonly model: Model<ShiftDocument>) {}

  findAll(): Promise<ShiftDocument[]> {
    return this.model.find().sort({ startTime: 1 }).exec()
  }

  findActive(): Promise<ShiftDocument[]> {
    return this.model.find({ active: true }).sort({ startTime: 1 }).exec()
  }

  findById(id: string): Promise<ShiftDocument | null> {
    return this.model.findById(id).exec()
  }

  findByName(name: string): Promise<ShiftDocument | null> {
    return this.model.findOne({ name }).exec()
  }

  create(data: CreateShiftData): Promise<ShiftDocument> {
    return this.model.create({ ...data, active: true })
  }

  upsertByName(name: string, data: CreateShiftData): Promise<ShiftDocument | null> {
    return this.model.findOneAndUpdate({ name }, { $set: data }, { new: true, upsert: true }).exec()
  }

  setActive(id: string, active: boolean): Promise<ShiftDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { active } }, { new: true }).exec()
  }
}
