import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { isDuplicateKeyError } from '../config/database/is-duplicate-key-error'
import { DomainException } from '../config/exceptions/domain.exception'
import { ORDER_STATE_ALREADY_EXISTS, OrderState, OrderStateDocument } from './order-state.model'

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

  async create(data: CreateOrderStateData): Promise<OrderStateDocument> {
    try {
      return await this.model.create({ ...data, active: true })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DomainException(
          ORDER_STATE_ALREADY_EXISTS,
          'Ya existe un estado con ese código',
          409,
        )
      }
      throw error
    }
  }

  upsertByCode(data: CreateOrderStateData): Promise<OrderStateDocument | null> {
    return this.model
      .findOneAndUpdate(
        { code: data.code },
        { $setOnInsert: { ...data, active: true } },
        { new: true, upsert: true },
      )
      .exec()
  }

  update(code: string, patch: UpdateOrderStateData): Promise<OrderStateDocument | null> {
    return this.model.findOneAndUpdate({ code }, { $set: patch }, { new: true }).exec()
  }

  setActive(code: string, active: boolean): Promise<OrderStateDocument | null> {
    return this.model.findOneAndUpdate({ code }, { $set: { active } }, { new: true }).exec()
  }
}
