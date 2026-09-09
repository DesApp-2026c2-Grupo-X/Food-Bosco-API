import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { CART_STATUS } from '../config/constants'
import { Cart, CartDocument } from './cart.model'

export interface CartItemData {
  productId: string
  quantity: number
  observations: string | null
  optionIds: string[]
}

@Injectable()
export class CartRepository {
  constructor(@InjectModel(Cart.name) private readonly model: Model<CartDocument>) {}

  findActiveByClient(clientId: string): Promise<CartDocument | null> {
    return this.model.findOne({ clientId, status: CART_STATUS.active }).exec()
  }

  findById(id: string): Promise<CartDocument | null> {
    return this.model.findById(id).exec()
  }

  createActive(clientId: string): Promise<CartDocument> {
    return this.model.create({ clientId, status: CART_STATUS.active, items: [], total: 0 })
  }

  setItemsAndTotal(id: string, items: CartItemData[], total: number): Promise<CartDocument | null> {
    return this.model.findByIdAndUpdate(id, { $set: { items, total } }, { new: true }).exec()
  }

  confirm(id: string): Promise<CartDocument | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: { status: CART_STATUS.confirmed } }, { new: true })
      .exec()
  }
}
