import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RIDER_STATUS, RiderStatus } from '../config/constants'
import { Rider, RiderDocument } from './rider.model'

export interface CreateRiderData {
  userId: string
  firstName: string
  lastName: string
  vehicle: string | null
  phone: string
}

export interface UpdateRiderProfileData {
  vehicle?: string | null
  phone?: string
}

@Injectable()
export class RiderRepository {
  constructor(@InjectModel(Rider.name) private readonly model: Model<RiderDocument>) {}

  findByUserId(userId: string): Promise<RiderDocument | null> {
    return this.model.findOne({ userId }).exec()
  }

  create(data: CreateRiderData): Promise<RiderDocument> {
    return this.model.create({
      ...data,
      available: false,
      status: RIDER_STATUS.offline,
      currentLocation: null,
    })
  }

  updateProfile(userId: string, patch: UpdateRiderProfileData): Promise<RiderDocument | null> {
    return this.model.findOneAndUpdate({ userId }, { $set: patch }, { new: true }).exec()
  }

  setAvailability(
    userId: string,
    available: boolean,
    status: RiderStatus,
  ): Promise<RiderDocument | null> {
    return this.model
      .findOneAndUpdate({ userId }, { $set: { available, status } }, { new: true })
      .exec()
  }

  setLocation(
    userId: string,
    location: { latitude: number; longitude: number },
  ): Promise<RiderDocument | null> {
    return this.model
      .findOneAndUpdate({ userId }, { $set: { currentLocation: location } }, { new: true })
      .exec()
  }

  setStatus(userId: string, status: RiderStatus): Promise<RiderDocument | null> {
    return this.model.findOneAndUpdate({ userId }, { $set: { status } }, { new: true }).exec()
  }
}
