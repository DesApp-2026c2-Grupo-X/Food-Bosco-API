import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DELIVERY_ORDER_STATUS } from '../config/constants'
import { DeliveryOrder, DeliveryOrderDocument } from './delivery-order.model'

export interface UpsertDeliveryOrderData {
  orderId: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

@Injectable()
export class DeliveryOrderRepository {
  constructor(
    @InjectModel(DeliveryOrder.name) private readonly model: Model<DeliveryOrderDocument>,
  ) {}

  upsertReady(data: UpsertDeliveryOrderData): Promise<DeliveryOrderDocument | null> {
    return this.model
      .findOneAndUpdate(
        { orderId: data.orderId },
        {
          $set: {
            branchId: data.branchId,
            branchLocation: data.branchLocation,
            deliveryAddress: data.deliveryAddress,
            status: DELIVERY_ORDER_STATUS.ready,
            tripId: null,
            reservedUntil: null,
          },
        },
        { new: true, upsert: true },
      )
      .exec()
  }

  remove(orderId: string): Promise<unknown> {
    return this.model.deleteOne({ orderId }).exec()
  }

  listReady(): Promise<DeliveryOrderDocument[]> {
    return this.model.find({ status: DELIVERY_ORDER_STATUS.ready }).sort({ createdAt: 1 }).exec()
  }

  reserve(orderIds: string[], tripId: string, reservedUntil: Date): Promise<unknown> {
    return this.model
      .updateMany(
        { orderId: { $in: orderIds }, status: DELIVERY_ORDER_STATUS.ready },
        { $set: { status: DELIVERY_ORDER_STATUS.reserved, tripId, reservedUntil } },
      )
      .exec()
  }

  markAssigned(orderIds: string[]): Promise<unknown> {
    return this.model
      .updateMany(
        { orderId: { $in: orderIds }, status: DELIVERY_ORDER_STATUS.reserved },
        { $set: { status: DELIVERY_ORDER_STATUS.assigned, reservedUntil: null } },
      )
      .exec()
  }

  releaseByTripId(tripId: string): Promise<unknown> {
    return this.model
      .updateMany(
        { tripId, status: DELIVERY_ORDER_STATUS.reserved },
        { $set: { status: DELIVERY_ORDER_STATUS.ready, tripId: null, reservedUntil: null } },
      )
      .exec()
  }

  async findExpiredReservations(now: Date): Promise<string[]> {
    const docs = await this.model
      .find({ status: DELIVERY_ORDER_STATUS.reserved, reservedUntil: { $lt: now } })
      .exec()

    return docs.map((doc) => doc.tripId).filter((tripId): tripId is string => tripId !== null)
  }

  releaseExpired(now: Date): Promise<unknown> {
    return this.model
      .updateMany(
        { status: DELIVERY_ORDER_STATUS.reserved, reservedUntil: { $lt: now } },
        { $set: { status: DELIVERY_ORDER_STATUS.ready, tripId: null, reservedUntil: null } },
      )
      .exec()
  }
}
