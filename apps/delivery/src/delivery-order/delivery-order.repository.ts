import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DELIVERY_ORDER_STATUS } from '../config/constants'
import {
  DeliveryOrder,
  DeliveryOrderDocument,
  ProcessedEvent,
  ProcessedEventDocument,
} from './delivery-order.model'

export interface UpsertDeliveryOrderData {
  orderId: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000

const IN_FLIGHT_STATUSES = [DELIVERY_ORDER_STATUS.reserved, DELIVERY_ORDER_STATUS.assigned]

@Injectable()
export class DeliveryOrderRepository {
  constructor(
    @InjectModel(DeliveryOrder.name) private readonly model: Model<DeliveryOrderDocument>,
    @InjectModel(ProcessedEvent.name)
    private readonly processedModel: Model<ProcessedEventDocument>,
  ) {}

  async markProcessed(eventId: string): Promise<boolean> {
    try {
      await this.processedModel.create({ eventId })
      return true
    } catch (error) {
      if (isDuplicateKeyError(error)) return false
      throw error
    }
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await this.processedModel.exists({ eventId }).exec()
    return existing !== null
  }

  findByOrderId(orderId: string): Promise<DeliveryOrderDocument | null> {
    return this.model.findOne({ orderId }).exec()
  }

  async upsertReady(data: UpsertDeliveryOrderData): Promise<DeliveryOrderDocument | null> {
    try {
      return await this.model
        .findOneAndUpdate(
          { orderId: data.orderId, status: { $nin: IN_FLIGHT_STATUSES } },
          {
            $set: {
              branchId: data.branchId,
              branchLocation: data.branchLocation,
              deliveryAddress: data.deliveryAddress,
              status: DELIVERY_ORDER_STATUS.ready,
              tripId: null,
              reservedUntil: null,
              rotationRoster: null,
              rotationIndex: null,
              rotationTurnUntil: null,
            },
          },
          { new: true, upsert: true },
        )
        .exec()
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  }

  remove(orderId: string): Promise<unknown> {
    return this.model.deleteOne({ orderId }).exec()
  }

  listReadyDocs(): Promise<DeliveryOrderDocument[]> {
    return this.model.find({ status: DELIVERY_ORDER_STATUS.ready }).sort({ createdAt: 1 }).exec()
  }

  findReservedDocsByTripId(tripId: string): Promise<DeliveryOrderDocument[]> {
    return this.model.find({ tripId, status: DELIVERY_ORDER_STATUS.reserved }).exec()
  }

  findExpiredReservedDocs(now: Date): Promise<DeliveryOrderDocument[]> {
    return this.model
      .find({ status: DELIVERY_ORDER_STATUS.reserved, reservedUntil: { $lt: now } })
      .exec()
  }

  async reserve(orderIds: string[], tripId: string, reservedUntil: Date): Promise<number> {
    const result = await this.model
      .updateMany(
        { orderId: { $in: orderIds }, status: DELIVERY_ORDER_STATUS.ready },
        { $set: { status: DELIVERY_ORDER_STATUS.reserved, tripId, reservedUntil } },
      )
      .exec()

    return result.matchedCount
  }

  markAssigned(orderIds: string[], tripId: string): Promise<unknown> {
    return this.model
      .updateMany(
        { orderId: { $in: orderIds }, tripId, status: DELIVERY_ORDER_STATUS.reserved },
        { $set: { status: DELIVERY_ORDER_STATUS.assigned, reservedUntil: null } },
      )
      .exec()
  }
}
