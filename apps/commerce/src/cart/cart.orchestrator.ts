import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import type { PublicCart } from './cart.model'
import type { CartItemData } from './cart.repository'
import { CartService } from './cart.service'

export interface AddCartItemInput {
  productId: string
  quantity: number
  observations?: string | null
  optionIds?: string[]
}

export interface UpdateCartItemInput {
  quantity?: number
  observations?: string | null
  optionIds?: string[]
}

@Injectable()
export class CartOrchestrator {
  constructor(
    private readonly cartService: CartService,
    private readonly productService: ProductService,
  ) {}

  async getCart(clientId: string): Promise<PublicCart> {
    const cart = await this.cartService.findActiveByClient(clientId)
    return cart ?? this.cartService.createActive(clientId)
  }

  async addItem(clientId: string, input: AddCartItemInput): Promise<PublicCart> {
    const product = await this.requireAvailableProduct(input.productId)
    const optionIds = input.optionIds ?? []
    this.validateOptions(product, optionIds)

    const cart = await this.getCart(clientId)
    const items: CartItemData[] = [
      ...cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        observations: item.observations,
        optionIds: item.optionIds,
      })),
      {
        productId: input.productId,
        quantity: input.quantity,
        observations: input.observations ?? null,
        optionIds,
      },
    ]

    const total = await this.computeTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    return updated ?? this.notFound()
  }

  async updateItem(clientId: string, itemId: string, patch: UpdateCartItemInput): Promise<PublicCart> {
    const cart = await this.getCart(clientId)
    const existing = cart.items.find((item) => item.id === itemId)
    if (!existing) {
      throw new DomainException(ERROR_CODES.cartItemNotFound, 'Ítem del carrito no encontrado', 404)
    }

    const optionIds = patch.optionIds ?? existing.optionIds
    const product = await this.requireAvailableProduct(existing.productId)
    this.validateOptions(product, optionIds)

    const items: CartItemData[] = cart.items.map((item) => {
      if (item.id !== itemId) {
        return {
          productId: item.productId,
          quantity: item.quantity,
          observations: item.observations,
          optionIds: item.optionIds,
        }
      }
      return {
        productId: item.productId,
        quantity: patch.quantity ?? item.quantity,
        observations: patch.observations !== undefined ? patch.observations : item.observations,
        optionIds,
      }
    })

    const total = await this.computeTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    return updated ?? this.notFound()
  }

  async removeItem(clientId: string, itemId: string): Promise<PublicCart> {
    const cart = await this.getCart(clientId)
    const existing = cart.items.find((item) => item.id === itemId)
    if (!existing) {
      throw new DomainException(ERROR_CODES.cartItemNotFound, 'Ítem del carrito no encontrado', 404)
    }

    const items: CartItemData[] = cart.items
      .filter((item) => item.id !== itemId)
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        observations: item.observations,
        optionIds: item.optionIds,
      }))

    const total = await this.computeTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    return updated ?? this.notFound()
  }

  async confirmCart(clientId: string): Promise<PublicCart> {
    const cart = await this.getCart(clientId)
    const confirmed = await this.cartService.confirm(cart.id)
    return confirmed ?? this.notFound()
  }

  async replaceItems(clientId: string, items: CartItemData[]): Promise<PublicCart> {
    const cart = await this.getCart(clientId)
    const total = await this.computeTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    return updated ?? this.notFound()
  }

  private async requireAvailableProduct(productId: string): Promise<PublicProduct> {
    const product = await this.productService.findById(productId)
    if (!product || !product.available) {
      throw new DomainException(ERROR_CODES.productUnavailable, 'Producto no disponible', 400)
    }
    return product
  }

  private validateOptions(product: PublicProduct, optionIds: string[]): void {
    const availableOptions = product.configGroups.flatMap((group) => group.options)

    for (const optionId of optionIds) {
      const option = availableOptions.find((entry) => entry.id === optionId)
      if (!option || !option.available) {
        throw new DomainException(
          ERROR_CODES.productUnavailable,
          'Configuración no disponible',
          400,
        )
      }
    }
  }

  private unitPrice(product: PublicProduct, optionIds: string[]): number {
    const availableOptions = product.configGroups.flatMap((group) => group.options)
    const extras = availableOptions
      .filter((option) => optionIds.includes(option.id))
      .reduce((sum, option) => sum + option.extraPrice, 0)
    return product.price + extras
  }

  private async computeTotal(items: CartItemData[]): Promise<number> {
    if (items.length === 0) {
      return 0
    }

    const products = await this.productService.findByIds(items.map((item) => item.productId))
    const productById = new Map(products.map((product) => [product.id, product]))

    return items.reduce((total, item) => {
      const product = productById.get(item.productId)
      if (!product) return total
      return total + this.unitPrice(product, item.optionIds) * item.quantity
    }, 0)
  }

  private notFound(): never {
    throw new DomainException(ERROR_CODES.cartNotFound, 'Carrito no encontrado', 404)
  }
}
