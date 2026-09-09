import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { OrderStatus } from '../config/constants'
import { Order, OrderDocument, OrderItem, OrderStatusHistory } from './order.model'

export interface CreateOrderData {
  number: string
  clientId: string
  branchId: string
  addressId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
  total: number
  estimatedDeliveryAt: Date | null
  items: OrderItem[]
}

export interface OrderListQuery {
  clientId?: string
  branchId?: string
  status?: OrderStatus
  search?: string
  limit: number
  offset: number
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

@Injectable()
export class OrderRepository {
  constructor(@InjectModel(Order.name) private readonly model: Model<OrderDocument>) {}

  findById(id: string): Promise<OrderDocument | null> {
    return this.model.findById(id).exec()
  }

  count(): Promise<number> {
    return this.model.countDocuments().exec()
  }

  create(data: CreateOrderData, initialHistory: OrderStatusHistory): Promise<OrderDocument> {
    return this.model.create({
      ...data,
      status: 'pending',
      statusHistory: [initialHistory],
    })
  }

  async list(query: OrderListQuery): Promise<{ data: OrderDocument[]; total: number }> {
    const filter: Record<string, unknown> = {}
    if (query.clientId) filter.clientId = query.clientId
    if (query.branchId) filter.branchId = query.branchId
    if (query.status) filter.status = query.status
    if (query.search) filter.number = new RegExp(escapeRegex(query.search), 'i')

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.offset).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ])

    return { data, total }
  }

  save(doc: OrderDocument): Promise<OrderDocument> {
    return doc.save()
  }

  markAssigned(orderIds: string[], tripId: string, riderId: string): Promise<unknown> {
    return this.model.updateMany({ _id: { $in: orderIds } }, { $set: { tripId, riderId } }).exec()
  }
}
