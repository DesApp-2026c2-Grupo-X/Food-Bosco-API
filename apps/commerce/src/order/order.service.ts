import { Injectable } from '@nestjs/common'
import { ERROR_CODES, ORDER_STATUS, ORDER_TRANSITIONS, OrderStatus } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { OrderStatusHistory, PublicOrder, serializeOrder } from './order.model'
import { CreateOrderData, OrderListQuery, OrderRepository } from './order.repository'

export interface OrderListResponse {
  data: PublicOrder[]
  meta: { total: number; limit: number; offset: number }
}

export interface CreateOrderInput {
  clientId: string
  branchId: string
  addressId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
  total: number
  estimatedDeliveryAt: Date | null
  items: CreateOrderData['items']
}

export interface TransitionResult {
  order: PublicOrder
  changed: boolean
}

@Injectable()
export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  async list(query: OrderListQuery): Promise<OrderListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializeOrder),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicOrder | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeOrder(doc) : null
  }

  async create(input: CreateOrderInput): Promise<PublicOrder> {
    const sequence = (await this.repository.count()) + 1
    const number = String(sequence).padStart(6, '0')

    const initialHistory: OrderStatusHistory = {
      previousStatus: ORDER_STATUS.pending,
      newStatus: ORDER_STATUS.pending,
      changedAt: new Date(),
    }

    const doc = await this.repository.create({ ...input, number }, initialHistory)
    return serializeOrder(doc)
  }

  async applyTransition(id: string, newStatus: OrderStatus): Promise<TransitionResult | null> {
    const doc = await this.repository.findById(id)
    if (!doc) {
      return null
    }

    if (doc.status === newStatus) {
      return { order: serializeOrder(doc), changed: false }
    }

    const allowed = ORDER_TRANSITIONS[doc.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new DomainException(
        ERROR_CODES.invalidTransition,
        `Transición inválida: ${doc.status} → ${newStatus}`,
        409,
      )
    }

    const updated = await this.repository.transition(id, doc.status, newStatus, {
      previousStatus: doc.status,
      newStatus,
      changedAt: new Date(),
    })

    if (updated) {
      return { order: serializeOrder(updated), changed: true }
    }

    const current = await this.repository.findById(id)
    if (!current) {
      return null
    }
    if (current.status === newStatus) {
      return { order: serializeOrder(current), changed: false }
    }

    throw new DomainException(
      ERROR_CODES.conflict,
      'El pedido cambió de estado mientras se procesaba la solicitud. Revisá el estado actual e intentá de nuevo.',
      409,
    )
  }

  async revertTransition(id: string, newStatus: OrderStatus, previousStatus: OrderStatus): Promise<void> {
    await this.repository.revertTransition(id, newStatus, previousStatus)
  }

  async markAssigned(orderIds: string[], tripId: string, riderId: string): Promise<void> {
    await this.repository.markAssigned(orderIds, tripId, riderId)
  }
}
