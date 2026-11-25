import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import type { OrderStatus } from '../../config/constants'
import { Order, OrderDocument } from '../../order/order.model'
import type { PlannedOrder } from './demo-order.factory'

export interface InsertedDemoOrder {
  id: string
  number: string
  clientId: string
  branchId: string
  riderId: string | null
  status: OrderStatus
  deliveryAddress: { text: string; latitude: number; longitude: number }
  createdAt: Date
  pickedUpAt?: Date | null
  deliveredAt: Date
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
      riderId: order.riderId ?? null,
      tripId: null,
      items: order.items,
      statusHistory: order.statusHistory,
      demoBatchId: batchId,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    }))

    await this.model.collection.insertMany(documents)

    return documents.map((document) => {
      const lastChange =
        document.statusHistory[document.statusHistory.length - 1]?.changedAt ?? document.createdAt
      const pickedUp = document.statusHistory.find((entry) => entry.newStatus === 'on_the_way')
      return {
        id: document._id.toString(),
        number: document.number,
        clientId: document.clientId,
        branchId: document.branchId,
        riderId: document.riderId,
        status: document.status,
        deliveryAddress: document.deliveryAddress,
        createdAt: document.createdAt,
        pickedUpAt: pickedUp?.changedAt ?? null,
        deliveredAt: lastChange,
      }
    })
  }

  async findDemoOrderIds(): Promise<string[]> {
    const rows = await this.model
      .find({ demoBatchId: { $ne: null } }, { _id: 1 })
      .lean()
      .exec()
    return rows.map((row) => row._id.toString())
  }

  async resetDemoData(): Promise<number> {
    const result = await this.model.deleteMany({ demoBatchId: { $ne: null } }).exec()
    return result.deletedCount ?? 0
  }
}
