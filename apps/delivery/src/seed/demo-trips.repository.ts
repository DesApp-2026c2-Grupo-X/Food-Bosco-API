import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { TripStatus } from '../config/constants'
import { Trip, TripDocument, TripOrder, TripTariffSnapshot } from '../trip/trip.model'

export interface PlannedDemoTrip {
  riderId: string
  status: TripStatus
  orders: TripOrder[]
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  tariffSnapshot: TripTariffSnapshot
  earnings: number
  startedAt: Date
  completedAt: Date
  createdAt: Date
}

@Injectable()
export class DemoTripsRepository {
  constructor(@InjectModel(Trip.name) private readonly model: Model<TripDocument>) {}

  async findExistingOrderIds(orderIds: string[]): Promise<Set<string>> {
    if (orderIds.length === 0) return new Set()
    const rows = await this.model
      .find({ 'orders.orderId': { $in: orderIds } }, { 'orders.orderId': 1 })
      .lean()
      .exec()

    const existing = new Set<string>()
    for (const row of rows) {
      for (const order of row.orders ?? []) {
        if (order.orderId) existing.add(order.orderId)
      }
    }
    return existing
  }

  async insertCompleted(trips: PlannedDemoTrip[], batchId: string): Promise<number> {
    if (trips.length === 0) return 0

    const documents = trips.map((trip) => ({
      _id: new Types.ObjectId(),
      riderId: trip.riderId,
      status: trip.status,
      orders: trip.orders,
      distanceKm: trip.distanceKm,
      estimatedMinutes: trip.estimatedMinutes,
      estimatedEarnings: trip.estimatedEarnings,
      tariffSnapshot: trip.tariffSnapshot,
      earnings: trip.earnings,
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
      expiresAt: null,
      demoBatchId: batchId,
      createdAt: trip.createdAt,
      updatedAt: trip.completedAt,
    }))

    await this.model.collection.insertMany(documents)
    return documents.length
  }

  async resetDemoData(): Promise<number> {
    const result = await this.model.deleteMany({ demoBatchId: { $ne: null } }).exec()
    return result.deletedCount ?? 0
  }
}
