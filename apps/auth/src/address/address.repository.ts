import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Address, AddressDocument } from './address.model'

export interface CreateAddressData {
  label: string
  text: string
  city?: string
  postalCode?: string
  latitude: number
  longitude: number
}

export interface UpdateAddressData {
  label?: string
  text?: string
  city?: string
  postalCode?: string
  latitude?: number
  longitude?: number
}

@Injectable()
export class AddressRepository {
  constructor(@InjectModel(Address.name) private readonly model: Model<AddressDocument>) {}

  listByUser(userId: string): Promise<AddressDocument[]> {
    return this.model.find({ userId, active: true }).sort({ createdAt: -1 }).exec()
  }

  findOwnedById(id: string, userId: string): Promise<AddressDocument | null> {
    return this.model.findOne({ _id: id, userId, active: true }).exec()
  }

  create(userId: string, data: CreateAddressData): Promise<AddressDocument> {
    return this.model.create({ ...data, userId, active: true })
  }

  updateOwned(
    id: string,
    userId: string,
    patch: UpdateAddressData,
  ): Promise<AddressDocument | null> {
    return this.model.findOneAndUpdate({ _id: id, userId }, { $set: patch }, { new: true }).exec()
  }

  async softDeleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.model
      .updateOne({ _id: id, userId }, { $set: { active: false } })
      .exec()
    return result.modifiedCount > 0
  }
}
