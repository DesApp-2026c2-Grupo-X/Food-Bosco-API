import { Injectable } from '@nestjs/common'
import { PublicOrderState, serializeOrderState } from './order-state.model'
import {
  CreateOrderStateData,
  OrderStateRepository,
  UpdateOrderStateData,
} from './order-state.repository'

@Injectable()
export class OrderStateService {
  constructor(private readonly repository: OrderStateRepository) {}

  async list(): Promise<PublicOrderState[]> {
    const docs = await this.repository.findAll()
    return docs.map(serializeOrderState)
  }

  async findByCode(code: string): Promise<PublicOrderState | null> {
    const doc = await this.repository.findByCode(code)
    return doc ? serializeOrderState(doc) : null
  }

  async create(data: CreateOrderStateData): Promise<PublicOrderState> {
    const doc = await this.repository.create(data)
    return serializeOrderState(doc)
  }

  async update(code: string, patch: UpdateOrderStateData): Promise<PublicOrderState | null> {
    const doc = await this.repository.update(code, patch)
    return doc ? serializeOrderState(doc) : null
  }

  async setActive(code: string, active: boolean): Promise<PublicOrderState | null> {
    const doc = await this.repository.setActive(code, active)
    return doc ? serializeOrderState(doc) : null
  }
}
