import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { isValidObjectId, Model } from 'mongoose'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
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

  async listByUser(userId: string): Promise<AddressDocument[]> {
    if (!isValidObjectId(userId)) return []
    return this.model.find({ userId, active: true }).sort({ createdAt: -1 }).exec()
  }

  async findOwnedById(id: string, userId: string): Promise<AddressDocument | null> {
    if (!isValidObjectId(id) || !isValidObjectId(userId)) return null
    return this.model.findOne({ _id: id, userId, active: true }).exec()
  }

  async create(userId: string, data: CreateAddressData): Promise<AddressDocument> {
    if (!isValidObjectId(userId)) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return this.model.create({ ...data, userId, active: true })
  }

  async updateOwned(
    id: string,
    userId: string,
    patch: UpdateAddressData,
  ): Promise<AddressDocument | null> {
    if (!isValidObjectId(id) || !isValidObjectId(userId)) return null
    return this.model
      .findOneAndUpdate({ _id: id, userId, active: true }, { $set: patch }, { new: true })
      .exec()
  }

  async softDeleteOwned(id: string, userId: string): Promise<boolean> {
    if (!isValidObjectId(id) || !isValidObjectId(userId)) return false
    const result = await this.model
      .updateOne({ _id: id, userId, active: true }, { $set: { active: false } })
      .exec()
    return result.modifiedCount > 0
  }
}
