import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { OrderStatus } from '../../config/constants'
import { Order, OrderDocument } from '../../order/order.model'
import type { PlannedOrder } from './demo-order.factory'

export interface InsertedDemoOrder {
  id: string
  number: string
  status: OrderStatus
  branchId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
  createdAt: Date
}

@Injectable()
export class DemoOrdersRepository {
  constructor(@InjectModel(Order.name) private readonly model: Model<OrderDocument>) {}

  count(): Promise<number> {
    return this.model.countDocuments().exec()
  }

  /**
   * Inserta pedidos con fecha histórica.
   *
   * Usa la colección nativa a propósito: Mongoose pisaría `createdAt` con la
   * fecha actual y los reportes se calculan justamente por `createdAt`.
   */
  async insert(planned: PlannedOrder[], batchId: string): Promise<InsertedDemoOrder[]> {
    if (planned.length === 0) return []

    const base = await this.count()

    const documents = planned.map((order, index) => ({
      _id: new Types.ObjectId(),
      number: String(base + index + 1).padStart(6, '0'),
      clientId: order.clientId,
      branchId: order.branchId,
      addressId: order.addressId,
      deliveryAddress: order.deliveryAddress,
      status: order.status,
      total: order.total,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      riderId: null,
      tripId: null,
      items: order.items,
      statusHistory: order.statusHistory,
      demoBatchId: batchId,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    }))

    await this.model.collection.insertMany(documents)

    return documents.map((document) => ({
      id: document._id.toString(),
      number: document.number,
      status: document.status,
      branchId: document.branchId,
      deliveryAddress: document.deliveryAddress,
      createdAt: document.createdAt,
    }))
  }

  async resetDemoData(): Promise<number> {
    const result = await this.model.deleteMany({ demoBatchId: { $ne: null } }).exec()
    return result.deletedCount ?? 0
  }
}
