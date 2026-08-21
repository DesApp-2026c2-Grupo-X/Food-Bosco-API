import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { TripStatus } from '../config/constants'
import { Trip, TripDocument, TripOrder } from './trip.model'

export interface CreateTripData {
  riderId: string
  status: TripStatus
  orders: TripOrder[]
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  expiresAt: Date | null
}

@Injectable()
export class TripRepository {
  constructor(@InjectModel(Trip.name) private readonly model: Model<TripDocument>) {}

  create(data: CreateTripData): Promise<TripDocument> {
    return this.model.create(data)
  }

  findById(id: string): Promise<TripDocument | null> {
    return this.model.findById(id).exec()
  }

  findByIdForRider(id: string, riderId: string): Promise<TripDocument | null> {
    return this.model.findOne({ _id: id, riderId }).exec()
  }

  async listByRider(
    riderId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: TripDocument[]; total: number }> {
    const filter = { riderId }
    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  save(doc: TripDocument): Promise<TripDocument> {
    return doc.save()
  }
}
