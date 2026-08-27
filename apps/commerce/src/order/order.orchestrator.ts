import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { CartItemData } from '../cart/cart.repository'
import { CartOrchestrator } from '../cart/cart.orchestrator'
import { CartService } from '../cart/cart.service'
import {
  ERROR_CODES,
  ORDER_STATUS,
  PARAMETER_KEYS,
  ROLES,
  OrderStatus,
} from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { estimateMinutes, haversineDistanceKm } from '../config/geo/distance'
import { EventBus } from '../config/messaging/event-bus'
import { ORDER_STATUS_CHANGED_EVENT } from '../config/messaging/events'
import type { OrderStatusChangedEvent } from '../config/messaging/events'
import type { AuthContext } from '../config/security/jwt.service'
import type { PublicBranch } from '../branch/branch.model'
import { BranchService } from '../branch/branch.service'
import { ParameterService } from '../parameter/parameter.service'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import { StockService } from '../stock/stock.service'
import type { IngredientRequirements } from '../stock/stock.service'
import type { PublicCart } from '../cart/cart.model'
import type { PublicOrder } from './order.model'
import { OrderService } from './order.service'

export interface CreateOrderInput {
  addressId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

export interface RepeatOrderResult {
  cart: PublicCart
  skippedProducts: PublicProduct[]
}

@Injectable()
export class OrderOrchestrator {
  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly cartOrchestrator: CartOrchestrator,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly stockService: StockService,
    private readonly parameterService: ParameterService,
    private readonly eventBus: EventBus,
  ) {}

  async create(clientId: string, input: CreateOrderInput): Promise<PublicOrder> {
    const cart = await this.cartService.findActiveByClient(clientId)
    if (!cart || cart.items.length === 0) {
      throw new DomainException(ERROR_CODES.cartNotFound, 'Carrito vacío o inexistente', 400)
    }

    const branches = await this.branchService.findAvailable(
      input.deliveryAddress.latitude,
      input.deliveryAddress.longitude,
    )
    if (branches.length === 0) {
      throw new DomainException(
        ERROR_CODES.noBranchAvailable,
        'No hay sucursal disponible para esta ubicación',
        409,
      )
    }
    const branch = branches[0]

    const { items, requirements } = await this.buildOrderItems(cart.items)

    await this.stockService.validateAvailability(branch.id, requirements)

    const total = items.reduce((sum, item) => sum + item.subtotal, 0)
    const estimatedDeliveryAt = await this.computeEta(branch, input.deliveryAddress)

    const order = await this.orderService.create({
      clientId,
      branchId: branch.id,
      addressId: input.addressId,
      deliveryAddress: input.deliveryAddress,
      total,
      estimatedDeliveryAt,
      items,
    })

    await this.cartService.confirm(cart.id)

    return order
  }

  async changeStatus(
    actor: AuthContext,
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<PublicOrder> {
    const order = await this.orderService.findById(orderId)
    if (!order) {
      throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404)
    }
    this.assertBranchAccess(actor, order)

    const result = await this.orderService.applyTransition(orderId, newStatus)
    if (!result) {
      throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404)
    }

    if (result.changed) {
      if (newStatus === ORDER_STATUS.preparing) {
        const requirements = await this.computeRequirementsFromOrder(result.order)
        await this.stockService.discount(order.branchId, requirements, order.id)
      }

      const branch = await this.branchService.findById(order.branchId)
      await this.eventBus.publish(this.toStatusChangedEvent(result.order, branch))
    }

    return result.order
  }

  async repeat(clientId: string, orderId: string): Promise<RepeatOrderResult> {
    const order = await this.orderService.findById(orderId)
    if (!order || order.clientId !== clientId) {
      throw new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404)
    }

    const items: CartItemData[] = []
    const skippedProducts: PublicProduct[] = []

    for (const item of order.items) {
      const product = await this.productService.findById(item.productId)
      if (!product) {
        continue
      }
      if (!product.available) {
        skippedProducts.push(product)
        continue
      }

      items.push({
        productId: item.productId,
        quantity: item.quantity,
        observations: item.observations,
        optionIds: item.options.map((option) => option.optionId),
      })
    }

    const cart = await this.cartOrchestrator.replaceItems(clientId, items)
    return { cart, skippedProducts }
  }

  private async buildOrderItems(
    cartItems: CartItemData[],
  ): Promise<{ items: PublicOrder['items']; requirements: IngredientRequirements }> {
    const productIds = cartItems.map((item) => item.productId)
    const products = await this.productService.findByIds(productIds)
    const productById = new Map(products.map((product) => [product.id, product]))

    const items: PublicOrder['items'] = []
    const requirements: IngredientRequirements = {}

    for (const cartItem of cartItems) {
      const product = productById.get(cartItem.productId)
      if (!product || !product.available) {
        throw new DomainException(ERROR_CODES.productUnavailable, 'Producto no disponible', 400)
      }

      const options = this.resolveOptions(product, cartItem.optionIds)
      const unitPrice =
        product.price + options.reduce((sum, option) => sum + option.extraPrice, 0)

      items.push({
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: cartItem.quantity,
        observations: cartItem.observations,
        subtotal: unitPrice * cartItem.quantity,
        options,
      })

      this.accumulateRequirements(requirements, product, cartItem.optionIds, cartItem.quantity)
    }

    return { items, requirements }
  }

  private async computeRequirementsFromOrder(
    order: PublicOrder,
  ): Promise<IngredientRequirements> {
    const productIds = order.items.map((item) => item.productId)
    const products = await this.productService.findByIds(productIds)
    const productById = new Map(products.map((product) => [product.id, product]))

    const requirements: IngredientRequirements = {}
    for (const item of order.items) {
      const product = productById.get(item.productId)
      if (!product) continue
      const optionIds = item.options.map((option) => option.optionId)
      this.accumulateRequirements(requirements, product, optionIds, item.quantity)
    }
    return requirements
  }

  private resolveOptions(
    product: PublicProduct,
    optionIds: string[],
  ): { optionId: string; name: string; extraPrice: number }[] {
    const availableOptions = product.configGroups.flatMap((group) => group.options)

    return optionIds.map((optionId) => {
      const option = availableOptions.find((entry) => entry.id === optionId)
      if (!option || !option.available) {
        throw new DomainException(
          ERROR_CODES.productUnavailable,
          'Configuración no disponible',
          400,
        )
      }
      return { optionId: option.id, name: option.name, extraPrice: option.extraPrice }
    })
  }

  private accumulateRequirements(
    requirements: IngredientRequirements,
    product: PublicProduct,
    optionIds: string[],
    quantity: number,
  ): void {
    for (const entry of product.recipe) {
      const adjustment = entry.optionAdjustments.find((adj) => optionIds.includes(adj.optionId))
      const perUnit = adjustment ? adjustment.quantity : entry.quantity
      requirements[entry.ingredientId] = (requirements[entry.ingredientId] ?? 0) + perUnit * quantity
    }
  }

  private async computeEta(
    branch: PublicBranch,
    deliveryAddress: { latitude: number; longitude: number },
  ): Promise<Date | null> {
    const basePrepMin = await this.parameterService.getValue(PARAMETER_KEYS.basePrepMin)
    const avgSpeedKmh = await this.parameterService.getValue(PARAMETER_KEYS.avgSpeedKmh)
    const distanceKm = haversineDistanceKm(branch, deliveryAddress)
    const etaMinutes = basePrepMin + estimateMinutes(distanceKm, avgSpeedKmh)
    return new Date(Date.now() + etaMinutes * 60 * 1000)
  }

  private assertBranchAccess(actor: AuthContext, order: PublicOrder): void {
    if (actor.internal) {
      return
    }
    if (actor.roles.includes(ROLES.superAdmin)) {
      return
    }
    if (actor.branchId !== order.branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin acceso a esta sucursal', 403)
    }
  }

  private toStatusChangedEvent(
    order: PublicOrder,
    branch: PublicBranch | null,
  ): OrderStatusChangedEvent {
    return {
      type: ORDER_STATUS_CHANGED_EVENT,
      version: 1,
      eventId: randomUUID(),
      orderId: order.id,
      status: order.status,
      branchId: order.branchId,
      branchLocation: branch
        ? { latitude: branch.latitude, longitude: branch.longitude }
        : { latitude: 0, longitude: 0 },
      deliveryAddress: order.deliveryAddress,
      occurredAt: new Date().toISOString(),
    }
  }
}
