import { Injectable } from '@nestjs/common'
import { PublicCart, serializeCart } from './cart.model'
import { CartItemData, CartRepository } from './cart.repository'

@Injectable()
export class CartService {
  constructor(private readonly repository: CartRepository) {}

  async findActiveByClient(clientId: string): Promise<PublicCart | null> {
    const doc = await this.repository.findActiveByClient(clientId)
    return doc ? serializeCart(doc) : null
  }

  async findById(id: string): Promise<PublicCart | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializeCart(doc) : null
  }

  async createActive(clientId: string): Promise<PublicCart> {
    const doc = await this.repository.createActive(clientId)
    return serializeCart(doc)
  }

  async replaceItems(id: string, items: CartItemData[], total: number): Promise<PublicCart | null> {
    const doc = await this.repository.setItemsAndTotal(id, items, total)
    return doc ? serializeCart(doc) : null
  }

  async confirm(id: string): Promise<PublicCart | null> {
    const doc = await this.repository.confirm(id)
    return doc ? serializeCart(doc) : null
  }
}
