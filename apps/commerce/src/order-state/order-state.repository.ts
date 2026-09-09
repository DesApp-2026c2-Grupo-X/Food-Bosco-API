import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { OrderState, OrderStateDocument } from './order-state.model'

export interface CreateOrderStateData {
  code: string
  name: string
  order: number
}

export interface UpdateOrderStateData {
  name?: string
  order?: number
}

@Injectable()
export class OrderStateRepository {
  constructor(@InjectModel(OrderState.name) private readonly model: Model<OrderStateDocument>) {}

  findAll(): Promise<OrderStateDocument[]> {
    return this.model.find().sort({ order: 1 }).exec()
  }

  findByCode(code: string): Promise<OrderStateDocument | null> {
    return this.model.findOne({ code }).exec()
  }

  create(data: CreateOrderStateData): Promise<OrderStateDocument> {
    return this.model.create({ ...data, active: true })
  }

  update(code: string, patch: UpdateOrderStateData): Promise<OrderStateDocument | null> {
    return this.model.findOneAndUpdate({ code }, { $set: patch }, { new: true }).exec()
  }

  setActive(code: string, active: boolean): Promise<OrderStateDocument | null> {
    return this.model.findOneAndUpdate({ code }, { $set: { active } }, { new: true }).exec()
  }
}
