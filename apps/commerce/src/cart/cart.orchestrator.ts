import { Injectable } from '@nestjs/common'
import { BranchService } from '../branch/branch.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import { evaluatePromotions, PromotableLine } from '../promotion/promotion.engine'
import { PromotionService } from '../promotion/promotion.service'
import type { AppliedPromotionPreview, PublicCart, PublicCartItem } from './cart.model'
import type { CartItemData } from './cart.repository'
import { CartService } from './cart.service'

const toItemData = (item: PublicCartItem): CartItemData => ({
  id: item.id,
  productId: item.productId,
  quantity: item.quantity,
  observations: item.observations,
  optionIds: item.optionIds,
})

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

export interface CartContext {
  latitude?: number
  longitude?: number
}

@Injectable()
export class CartOrchestrator {
  constructor(
    private readonly cartService: CartService,
    private readonly productService: ProductService,
    private readonly promotionService?: PromotionService,
    private readonly branchService?: BranchService,
  ) {}

  async getCart(clientId: string, context?: CartContext): Promise<PublicCart> {
    const cart =
      (await this.cartService.findActiveByClient(clientId)) ??
      (await this.cartService.createActive(clientId))
    return this.enrichCartWithPricing(cart, context)
  }

  async addItem(
    clientId: string,
    input: AddCartItemInput,
    context?: CartContext,
  ): Promise<PublicCart> {
    const product = await this.requireAvailableProduct(input.productId)
    const optionIds = input.optionIds ?? []
    this.validateOptions(product, optionIds)

    const cart = await this.getCart(clientId, context)
    const items: CartItemData[] = [
      ...cart.items.map(toItemData),
      {
        productId: input.productId,
        quantity: input.quantity,
        observations: input.observations ?? null,
        optionIds,
      },
    ]

    const total = await this.computeGrossTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    if (!updated) this.notFound()
    return this.enrichCartWithPricing({ ...updated, promotionCode: cart.promotionCode }, context)
  }

  async updateItem(
    clientId: string,
    itemId: string,
    patch: UpdateCartItemInput,
    context?: CartContext,
  ): Promise<PublicCart> {
    const cart = await this.getCart(clientId, context)
    const existing = cart.items.find((item) => item.id === itemId)
    if (!existing) {
      throw new DomainException(ERROR_CODES.cartItemNotFound, 'Ítem del carrito no encontrado', 404)
    }

    const optionIds = patch.optionIds ?? existing.optionIds
    const product = await this.requireAvailableProduct(existing.productId)
    this.validateOptions(product, optionIds)

    const items: CartItemData[] = cart.items.map((item) => {
      if (item.id !== itemId) {
        return toItemData(item)
      }
      return {
        ...toItemData(item),
        quantity: patch.quantity ?? item.quantity,
        observations: patch.observations !== undefined ? patch.observations : item.observations,
        optionIds,
      }
    })

    const total = await this.computeGrossTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    if (!updated) this.notFound()
    return this.enrichCartWithPricing({ ...updated, promotionCode: cart.promotionCode }, context)
  }

  async removeItem(clientId: string, itemId: string, context?: CartContext): Promise<PublicCart> {
    const cart = await this.getCart(clientId, context)
    const existing = cart.items.find((item) => item.id === itemId)
    if (!existing) {
      throw new DomainException(ERROR_CODES.cartItemNotFound, 'Ítem del carrito no encontrado', 404)
    }

    const items: CartItemData[] = cart.items.filter((item) => item.id !== itemId).map(toItemData)

    const total = await this.computeGrossTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    if (!updated) this.notFound()
    return this.enrichCartWithPricing({ ...updated, promotionCode: cart.promotionCode }, context)
  }

  async confirmCart(clientId: string): Promise<PublicCart> {
    const cart = await this.cartService.findActiveByClient(clientId)
    if (!cart || cart.items.length === 0) {
      throw new DomainException(ERROR_CODES.cartNotFound, 'Carrito vacío o inexistente', 404)
    }
    const confirmed = await this.cartService.confirm(cart.id)
    return confirmed ?? this.notFound()
  }

  async replaceItems(
    clientId: string,
    items: CartItemData[],
    context?: CartContext,
  ): Promise<PublicCart> {
    const cart = await this.getCart(clientId, context)
    const total = await this.computeGrossTotal(items)
    const updated = await this.cartService.replaceItems(cart.id, items, total)
    if (!updated) this.notFound()
    return this.enrichCartWithPricing({ ...updated, promotionCode: cart.promotionCode }, context)
  }

  async setPromotionCode(clientId: string, code: string | null): Promise<PublicCart> {
    const cart = await this.cartService.findActiveByClient(clientId)
    if (!cart) {
      throw new DomainException(ERROR_CODES.cartNotFound, 'Carrito no encontrado', 404)
    }

    const normCode = code ? code.trim().toUpperCase() : null

    if (normCode && this.promotionService) {
      const promo = await this.promotionService.findByCode(normCode)
      if (!promo) {
        throw new DomainException(
          ERROR_CODES.promotionCodeInvalid,
          'El código de cupón no existe',
          400,
        )
      }
      if (!promo.active) {
        throw new DomainException(ERROR_CODES.promotionCodeInvalid, 'El cupón no está activo', 400)
      }
      const now = new Date()
      if (now < new Date(promo.startDate) || now > new Date(promo.endDate)) {
        throw new DomainException(
          ERROR_CODES.promotionCodeInvalid,
          'El cupón ha vencido o aún no está vigente',
          400,
        )
      }
      const usage = await this.promotionService.getUsageMap([promo.id], clientId)
      const stats = usage.get(promo.id) ?? { total: 0, byCustomer: 0 }
      if (promo.maxUsesTotal !== null && stats.total >= promo.maxUsesTotal) {
        throw new DomainException(
          ERROR_CODES.promotionLimitReached,
          'El cupón ha alcanzado su límite total de usos',
          409,
        )
      }
      if (promo.maxUsesPerCustomer !== null && stats.byCustomer >= promo.maxUsesPerCustomer) {
        throw new DomainException(
          ERROR_CODES.promotionLimitReached,
          'Has alcanzado el límite de usos permitidos para este cupón',
          409,
        )
      }
    }

    await this.cartService.setPromotionCode(cart.id, normCode)
    return this.enrichCartWithPricing({ ...cart, promotionCode: normCode })
  }

  private async enrichCartWithPricing(
    cart: PublicCart,
    context?: CartContext,
  ): Promise<PublicCart> {
    if (cart.items.length === 0) {
      return {
        ...cart,
        subtotal: cart.subtotal ?? cart.total ?? 0,
        discountTotal: 0,
        total: cart.total ?? 0,
        appliedPromotions: [],
      }
    }

    const productIds = cart.items.map((i) => i.productId)
    const products = (await this.productService.findByIds(productIds)) ?? []
    const productById = new Map(products.map((p) => [p.id, p]))

    const lines: PromotableLine[] = []
    for (const item of cart.items) {
      const product = productById.get(item.productId)
      if (!product) continue
      const unitPrice = this.unitPrice(product, item.optionIds)
      lines.push({
        lineId: item.id,
        productId: product.id,
        categoryId: product.categoryId,
        unitPrice,
        quantity: item.quantity,
        subtotal: unitPrice * item.quantity,
      })
    }

    const grossSubtotal =
      lines.length > 0
        ? lines.reduce((sum, l) => sum + l.subtotal, 0)
        : (cart.subtotal ?? cart.total ?? 0)

    if (!this.promotionService) {
      return {
        ...cart,
        subtotal: grossSubtotal,
        discountTotal: 0,
        total: grossSubtotal,
        appliedPromotions: [],
      }
    }

    let branchId: string | null = null
    if (this.branchService && context?.latitude !== undefined && context?.longitude !== undefined) {
      const branches = await this.branchService.findAvailable(context.latitude, context.longitude)
      branchId = branches[0]?.id ?? null
    }

    const now = new Date()
    const candidates = await this.promotionService.getCandidates({
      branchId,
      now,
      code: cart.promotionCode,
    })

    const usage = await this.promotionService.getUsageMap(
      candidates.map((c) => c.id),
      cart.clientId,
    )

    const pricing = evaluatePromotions(candidates, {
      lines,
      subtotal: grossSubtotal,
      totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
      branchId,
      clientId: cart.clientId,
      now,
      requestedCode: cart.promotionCode,
      usage,
    })

    return {
      ...cart,
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      total: pricing.total,
      appliedPromotions: pricing.appliedPromotions as AppliedPromotionPreview[],
    }
  }

  private async requireAvailableProduct(productId: string): Promise<PublicProduct> {
    const product = await this.productService.findById(productId)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    if (!product.available) {
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

  private async computeGrossTotal(items: CartItemData[]): Promise<number> {
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
