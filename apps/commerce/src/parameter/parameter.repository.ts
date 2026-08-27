import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Parameter, ParameterDocument } from './parameter.model'

export interface CreateParameterData {
  key: string
  value: number
  unit: string
}

@Injectable()
export class ParameterRepository {
  constructor(@InjectModel(Parameter.name) private readonly model: Model<ParameterDocument>) {}

  findAll(): Promise<ParameterDocument[]> {
    return this.model.find().sort({ key: 1 }).exec()
  }

  findByKey(key: string): Promise<ParameterDocument | null> {
    return this.model.findOne({ key }).exec()
  }

  create(data: CreateParameterData): Promise<ParameterDocument> {
    return this.model.create(data)
  }

  update(key: string, value: number): Promise<ParameterDocument | null> {
    return this.model
      .findOneAndUpdate({ key }, { $set: { value } }, { new: true, upsert: true })
      .exec()
  }
}
