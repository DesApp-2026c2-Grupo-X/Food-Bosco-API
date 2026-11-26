import { Injectable, Logger } from '@nestjs/common'
import { join } from 'node:path'
import {
  createBatchId,
  createRandomSeed,
  createSeededRandom,
  isDuplicateKeyError,
  loadSeedData,
} from '@repo/seed-utils'
import type { PublicBranch } from '../branch/branch.model'
import { BranchService } from '../branch/branch.service'
import type { BranchHours } from '../branch/branch.model'
import { CategoryService } from '../category/category.service'
import {
  ORDER_STATUS,
  OrderStatus,
  PARAMETER_KEYS,
  PromotionScope,
  PromotionType,
} from '../config/constants'
import { env } from '../config/env'
import { IngredientService } from '../ingredient/ingredient.service'
import type { OrderItem } from '../order/order.model'
import { OrderService } from '../order/order.service'
import { OrderStateService } from '../order-state/order-state.service'
import { ParameterService } from '../parameter/parameter.service'
import type { PublicProduct } from '../product/product.model'
import { ProductService } from '../product/product.service'
import { PromotionService } from '../promotion/promotion.service'
import { StockService } from '../stock/stock.service'
import { buildBranchHours, type HoursSchedule } from './branch-hours'
import { buildDemoOrders, type DemoOrderConfig } from './demo/demo-order.factory'
import { DemoOrdersRepository, type InsertedDemoOrder } from './demo/demo-orders.repository'
import { buildDemoReviews } from './demo/demo-review.factory'
import { DemoReviewsRepository } from './demo/demo-reviews.repository'

interface BranchSeed {
  name: string
  addressText: string
  latitude: number
  longitude: number
  phone?: string
  hours?: BranchHours[]
}

interface OptionSeed {
  name: string
  extraPrice: number
}

interface GroupSeed {
  name: string
  type: 'single' | 'multiple'
  required: boolean
  min: number | null
  max: number | null
  options: OptionSeed[]
}

interface ProductSeed {
  category: string
  name: string
  description: string
  price: number
  image: string
  groups: GroupSeed[]
  recipe: { ingredient: string; quantity: number }[]
}

interface OrderItemSeed {
  product: string
  quantity: number
  options?: string[]
}

interface OrderSeed {
  branch: string
  status: OrderStatus
  items: OrderItemSeed[]
}

interface PromotionSeed {
  name: string
  description?: string
  type: PromotionType
  scope: PromotionScope
  categoryName?: string
  categoryNames?: string[]
  productNames?: string[]
  branchNames?: string[]
  discountValue?: number
  maxDiscount?: number
  buyQuantity?: number
  payQuantity?: number
  code?: string
  minSubtotal?: number
  minQuantity?: number
  maxUsesTotal?: number
  maxUsesPerCustomer?: number
  daysOfWeek?: number[]
  startTime?: string
  endTime?: string
  stackable?: boolean
  priority?: number
  active?: boolean
}

interface OrderStateSeed {
  code: string
  name: string
  order: number
}

interface ParameterSeed {
  key: string
  unit: string
}

interface LowStockSeed {
  branch: string
  items: { ingredient: string; quantity: number }[]
}

interface DemoSeedConfig extends DemoOrderConfig {
  outOfStock: {
    branch: string
    ingredients: string[]
  }
  lowStock?: LowStockSeed[]
}

interface CommerceSeedData {
  categories: string[]
  ingredients: { name: string; unit: string; minQuantity?: number }[]
  hours: HoursSchedule
  branches: BranchSeed[]
  products: ProductSeed[]
  promotions: PromotionSeed[]
  orderStates: OrderStateSeed[]
  parameters: ParameterSeed[]
  orders?: OrderSeed[]
}

export interface SeedOrderContext {
  client: { id: string }
  address: { id: string; text: string; latitude: number; longitude: number }
}

export interface SeedCustomerAddress {
  id: string
  text: string
  latitude: number
  longitude: number
}

export interface SeedCustomerContext {
  id: string
  addresses: SeedCustomerAddress[]
}

export interface SeedDemoOptions {
  orders?: number
  days?: number
  seed?: number
  reset?: boolean
}

export interface SeedOptions {
  order?: SeedOrderContext
  customers?: SeedCustomerContext[]
  riderIds?: string[]
  demo?: SeedDemoOptions
}

const DATA_DIR = join(__dirname, 'data')

const PARAMETER_VALUES: Record<string, number> = {
  [PARAMETER_KEYS.maxDistanceKm]: env.seed.maxDistanceKm,
  [PARAMETER_KEYS.basePrepMin]: env.seed.basePrepMin,
  [PARAMETER_KEYS.avgSpeedKmh]: env.seed.avgSpeedKmh,
}

const STATUS_PATHS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.pending]: [],
  [ORDER_STATUS.confirmed]: [ORDER_STATUS.confirmed],
  [ORDER_STATUS.preparing]: [ORDER_STATUS.confirmed, ORDER_STATUS.preparing],
  [ORDER_STATUS.readyForDelivery]: [
    ORDER_STATUS.confirmed,
    ORDER_STATUS.preparing,
    ORDER_STATUS.readyForDelivery,
  ],
  [ORDER_STATUS.onTheWay]: [
    ORDER_STATUS.confirmed,
    ORDER_STATUS.preparing,
    ORDER_STATUS.readyForDelivery,
    ORDER_STATUS.onTheWay,
  ],
  [ORDER_STATUS.delivered]: [
    ORDER_STATUS.confirmed,
    ORDER_STATUS.preparing,
    ORDER_STATUS.readyForDelivery,
    ORDER_STATUS.onTheWay,
    ORDER_STATUS.delivered,
  ],
  [ORDER_STATUS.cancelled]: [ORDER_STATUS.cancelled],
}

const MAX_DEMO_ORDERS = 2000
const MAX_DEMO_DAYS = 730
const READY_ORDER_WINDOW_MS = 6 * 60 * 60 * 1000
const MAX_READY_ORDERS = 12

interface SeedSummary {
  categories: number
  ingredients: number
  products: number
  branches: number
  promotions: number
  stockRows: number
  orderStates: number
  parameters: number
  orders: number
  demoOrders: number
}

export interface SeedOrderSummary {
  id: string
  number: string
  status: OrderStatus
  branchId: string
  branchName: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

export interface SeedDeliveredOrderSummary {
  orderId: string
  branchId: string
  riderId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
  createdAt: string
  pickedUpAt: string | null
  deliveredAt: string
}

export interface SeedDemoSummary {
  enabled: boolean
  batchId: string | null
  seed: number | null
  orders: number
  reviews: number
  customers: number
  resetDeleted: number
  outOfStockRows: number
}

export interface SeedResult {
  summary: SeedSummary
  branches: { id: string; name: string; latitude: number; longitude: number }[]
  orders: SeedOrderSummary[]
  deliveredOrders: SeedDeliveredOrderSummary[]
  demo: SeedDemoSummary
}

interface DemoRunResult {
  summary: SeedDemoSummary
  readyOrders: SeedOrderSummary[]
  deliveredOrders: SeedDeliveredOrderSummary[]
}

const emptyDemoSummary = (): SeedDemoSummary => ({
  enabled: false,
  batchId: null,
  seed: null,
  orders: 0,
  reviews: 0,
  customers: 0,
  resetDeleted: 0,
  outOfStockRows: 0,
})

const clampInt = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const candidate = Number.isFinite(value) ? Math.trunc(value as number) : fallback
  return Math.min(Math.max(candidate, min), max)
}

@Injectable()
export class SeedService {
  constructor(
    private readonly orderStateService: OrderStateService,
    private readonly parameterService: ParameterService,
    private readonly categoryService: CategoryService,
    private readonly ingredientService: IngredientService,
    private readonly branchService: BranchService,
    private readonly productService: ProductService,
    private readonly promotionService: PromotionService,
    private readonly stockService: StockService,
    private readonly orderService: OrderService,
    private readonly demoOrdersRepository: DemoOrdersRepository,
    private readonly demoReviewsRepository: DemoReviewsRepository,
  ) {}

  async seed(options: SeedOptions = {}): Promise<SeedResult> {
    const data = this.loadData()
    const demoConfig = this.loadDemoConfig()

    await this.seedOrderStates(data.orderStates)
    await this.seedParameters(data.parameters)

    const categories = await this.seedCategories(data.categories)
    const ingredients = await this.seedIngredients(data.ingredients)
    const branches = await this.seedBranches(data)
    const { createdCount: products, productByName } = await this.seedProducts(
      data.products,
      categories,
      ingredients,
    )
    const promotions = await this.seedPromotions(
      data.promotions,
      categories,
      branches,
      productByName,
    )
    const stockRows = await this.seedStock(branches, ingredients)
    const showcaseOrders = await this.seedOrders(data.orders ?? [], branches, options)

    const demoRun = await this.seedDemoOrders(branches, options, demoConfig)
    const outOfStockRows = demoRun.summary.enabled
      ? await this.seedDemoStock(demoConfig, branches, ingredients)
      : 0
    const demo: SeedDemoSummary = { ...demoRun.summary, outOfStockRows }

    const orders = [...showcaseOrders, ...demoRun.readyOrders]

    return {
      summary: {
        categories: categories.length,
        ingredients: ingredients.size,
        products,
        branches: branches.length,
        promotions,
        stockRows,
        orderStates: data.orderStates.length,
        parameters: data.parameters.length,
        orders: showcaseOrders.length,
        demoOrders: demo.orders,
      },
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        latitude: branch.latitude,
        longitude: branch.longitude,
      })),
      orders,
      deliveredOrders: demoRun.deliveredOrders,
      demo,
    }
  }

  private async seedDemoOrders(
    branches: PublicBranch[],
    options: SeedOptions,
    config: DemoSeedConfig,
  ): Promise<DemoRunResult> {
    const customers = (options.customers ?? []).filter((customer) => customer.addresses.length > 0)
    if (customers.length === 0) {
      return { summary: emptyDemoSummary(), readyOrders: [], deliveredOrders: [] }
    }

    const demo = options.demo ?? {}
    const orders = clampInt(
      demo.orders ?? env.seed.demo.orders ?? config.orders,
      config.orders,
      0,
      MAX_DEMO_ORDERS,
    )
    if (orders === 0) {
      return { summary: emptyDemoSummary(), readyOrders: [], deliveredOrders: [] }
    }

    const days = clampInt(
      demo.days ?? env.seed.demo.days ?? config.days,
      config.days,
      1,
      MAX_DEMO_DAYS,
    )
    const seedValue = demo.seed ?? env.seed.demo.seed ?? createRandomSeed()
    const random = createSeededRandom(seedValue)
    const reset = demo.reset ?? env.seed.demo.reset

    let resetDeleted = 0
    if (reset) {
      const demoOrderIds = await this.demoOrdersRepository.findDemoOrderIds()
      await this.demoReviewsRepository.deleteByOrderIds(demoOrderIds)
      resetDeleted = await this.demoOrdersRepository.resetDemoData()
    }

    const products = (await this.productService.list({ limit: 500, offset: 0 })).data.filter(
      (product) => product.available,
    )
    const activeBranches = branches.filter((branch) => branch.active)

    if (products.length === 0 || activeBranches.length === 0) {
      return {
        summary: { ...emptyDemoSummary(), resetDeleted },
        readyOrders: [],
        deliveredOrders: [],
      }
    }

    const now = new Date()
    const planned = buildDemoOrders({
      customers: customers.map((customer) => ({ id: customer.id, addresses: customer.addresses })),
      products,
      branches: activeBranches,
      riderIds: options.riderIds,
      config: { ...config, orders, days },
      random,
      now,
    })

    const batchId = createBatchId(seedValue)
    const inserted = await this.demoOrdersRepository.insert(planned, batchId)
    const plannedReviews = buildDemoReviews({
      orders: inserted,
      reviewRate: config.reviewRate,
      random,
      now,
    })
    const reviewsCount = await this.demoReviewsRepository.insert(plannedReviews)

    const branchById = new Map(activeBranches.map((branch) => [branch.id, branch]))
    const readyOrders = inserted
      .filter(
        (order) =>
          order.status === ORDER_STATUS.readyForDelivery &&
          order.createdAt.getTime() > Date.now() - READY_ORDER_WINDOW_MS,
      )
      .slice(0, MAX_READY_ORDERS)
      .map((order) => this.toDemoOrderSummary(order, branchById))

    const deliveredOrders: SeedDeliveredOrderSummary[] = inserted
      .filter(
        (order): order is InsertedDemoOrder & { riderId: string } =>
          order.status === ORDER_STATUS.delivered && order.riderId !== null,
      )
      .map((order) => {
        const branch = branchById.get(order.branchId)
        return {
          orderId: order.id,
          branchId: order.branchId,
          riderId: order.riderId,
          branchLocation: {
            latitude: branch?.latitude ?? 0,
            longitude: branch?.longitude ?? 0,
          },
          deliveryAddress: order.deliveryAddress,
          createdAt: order.createdAt.toISOString(),
          pickedUpAt: order.pickedUpAt ? order.pickedUpAt.toISOString() : null,
          deliveredAt: order.deliveredAt.toISOString(),
        }
      })

    Logger.log(
      `lote demo ${batchId}: ${inserted.length} pedidos de ${customers.length} clientes, ${reviewsCount} reseñas (semilla ${seedValue})`,
      'Seed',
    )

    return {
      summary: {
        enabled: true,
        batchId,
        seed: seedValue,
        orders: inserted.length,
        reviews: reviewsCount,
        customers: customers.length,
        resetDeleted,
        outOfStockRows: 0,
      },
      readyOrders,
      deliveredOrders,
    }
  }

  private toDemoOrderSummary(
    order: InsertedDemoOrder,
    branchById: Map<string, PublicBranch>,
  ): SeedOrderSummary {
    const branch = branchById.get(order.branchId)

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      branchId: order.branchId,
      branchName: branch?.name ?? '',
      branchLocation: {
        latitude: branch?.latitude ?? 0,
        longitude: branch?.longitude ?? 0,
      },
      deliveryAddress: order.deliveryAddress,
    }
  }

  private async seedDemoStock(
    config: DemoSeedConfig,
    branches: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<number> {
    let adjusted = 0
    const outBranch = branches.find((entry) => entry.name === config.outOfStock.branch)

    if (outBranch) {
      const stock = await this.stockService.list(outBranch.id)

      for (const name of config.outOfStock.ingredients) {
        const ingredientId = ingredients.get(name)
        if (!ingredientId) continue

        const row = stock.find((entry) => entry.ingredientId === ingredientId)
        if (!row || row.quantity <= 0) continue

        await this.stockService.adjust(outBranch.id, ingredientId, -row.quantity)
        adjusted += 1
      }

      if (adjusted > 0) {
        Logger.log(`stock agotado en ${outBranch.name}: ${adjusted} ingrediente(s)`, 'Seed')
      }
    }

    for (const group of config.lowStock ?? []) {
      const targetBranch = branches.find((entry) => entry.name === group.branch)
      if (!targetBranch) continue

      const stock = await this.stockService.list(targetBranch.id)
      for (const item of group.items) {
        const ingredientId = ingredients.get(item.ingredient)
        if (!ingredientId) continue

        const row = stock.find((entry) => entry.ingredientId === ingredientId)
        if (!row || row.quantity <= item.quantity) continue

        await this.stockService.adjust(targetBranch.id, ingredientId, item.quantity - row.quantity)
      }
    }

    return adjusted
  }

  private async seedOrders(
    seeds: OrderSeed[],
    branches: PublicBranch[],
    options: SeedOptions,
  ): Promise<SeedOrderSummary[]> {
    const context = options.order
    if (!context || seeds.length === 0) return []

    const existing = await this.orderService.list({
      clientId: context.client.id,
      limit: 500,
      offset: 0,
    })
    if (existing.meta.total >= seeds.length) return []

    const products = (await this.productService.list({ limit: 500, offset: 0 })).data
    const productByName = new Map(products.map((product) => [product.name, product]))
    const result: SeedOrderSummary[] = []

    for (const seed of seeds) {
      const branch = branches.find((entry) => entry.name === seed.branch)
      if (!branch) continue

      const items = this.buildOrderItems(seed.items, productByName)
      if (items.length === 0) continue

      const branchDoc = await this.branchService.findById(branch.id)
      const total = items.reduce((sum, item) => sum + item.subtotal, 0)

      const order = await this.orderService.create({
        clientId: context.client.id,
        branchId: branch.id,
        addressId: context.address.id,
        deliveryAddress: {
          text: context.address.text,
          latitude: context.address.latitude,
          longitude: context.address.longitude,
        },
        total,
        estimatedDeliveryAt: null,
        items,
      })

      await this.applyStatusPath(order.id, seed.status)

      result.push({
        id: order.id,
        number: order.number,
        status: seed.status,
        branchId: branch.id,
        branchName: branch.name,
        branchLocation: {
          latitude: branchDoc?.latitude ?? context.address.latitude,
          longitude: branchDoc?.longitude ?? context.address.longitude,
        },
        deliveryAddress: {
          text: context.address.text,
          latitude: context.address.latitude,
          longitude: context.address.longitude,
        },
      })

      Logger.log(`pedido creado: #${order.number} (${seed.status})`, 'Seed')
    }

    return result
  }

  private buildOrderItems(
    seeds: OrderItemSeed[],
    productByName: Map<string, PublicProduct>,
  ): OrderItem[] {
    return seeds.flatMap((seed) => {
      const product = productByName.get(seed.product)
      if (!product) return []

      const options = (seed.options ?? []).flatMap((optionName) => {
        const option = product.configGroups
          .flatMap((group) => group.options)
          .find((entry) => entry.name === optionName)
        return option
          ? [{ optionId: option.id, name: option.name, extraPrice: option.extraPrice }]
          : []
      })

      const unitPrice = product.price + options.reduce((sum, option) => sum + option.extraPrice, 0)

      return [
        {
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: seed.quantity,
          observations: null,
          subtotal: unitPrice * seed.quantity,
          options,
        },
      ]
    })
  }

  private async applyStatusPath(orderId: string, target: OrderStatus): Promise<void> {
    for (const status of STATUS_PATHS[target] ?? []) {
      await this.orderService.applyTransition(orderId, status)
    }
  }

  private async seedOrderStates(orderStates: OrderStateSeed[]): Promise<void> {
    for (const state of orderStates) {
      const existing = await this.orderStateService.findByCode(state.code)
      if (existing) continue
      await this.orderStateService.upsertByCode(state)
      Logger.log(`order-state creado: ${state.code}`, 'Seed')
    }
  }

  private async seedParameters(parameters: ParameterSeed[]): Promise<void> {
    for (const parameter of parameters) {
      const existing = await this.parameterService.findByKey(parameter.key)
      if (existing) continue
      await this.parameterService.upsertByKey({
        key: parameter.key,
        value: PARAMETER_VALUES[parameter.key] ?? 0,
        unit: parameter.unit,
      })
      Logger.log(`parameter creado: ${parameter.key}`, 'Seed')
    }
  }

  private async seedCategories(names: string[]): Promise<{ id: string; name: string }[]> {
    const { data } = await this.categoryService.list({ limit: 500, offset: 0 })
    const result: { id: string; name: string }[] = []

    for (const name of names) {
      const found = data.find((category) => category.name === name)
      if (found) {
        result.push({ id: found.id, name: found.name })
        continue
      }
      const created = await this.categoryService.upsertByName(name)
      result.push({ id: created.id, name: created.name })
      Logger.log(`categoría creada: ${created.name}`, 'Seed')
    }

    return result
  }

  private async seedIngredients(
    ingredients: { name: string; unit: string; minQuantity?: number }[],
  ): Promise<Map<string, string>> {
    const { data } = await this.ingredientService.list({ limit: 500, offset: 0 })
    const byName = new Map<string, string>()

    for (const seed of ingredients) {
      const existing = data.find((ingredient) => ingredient.name === seed.name)
      if (existing) {
        if ((existing.minQuantity ?? 0) === 0 && (seed.minQuantity ?? 0) > 0) {
          await this.ingredientService.update(existing.id, { minQuantity: seed.minQuantity })
        }
        byName.set(existing.name, existing.id)
        continue
      }
      const created = await this.ingredientService.upsertByName(seed)
      byName.set(created.name, created.id)
      Logger.log(`ingrediente creado: ${created.name}`, 'Seed')
    }

    return byName
  }

  private async seedBranches(data: CommerceSeedData): Promise<PublicBranch[]> {
    const { data: existingBranches } = await this.branchService.list({ limit: 500, offset: 0 })
    const result: PublicBranch[] = []

    for (const seed of data.branches) {
      const existing = existingBranches.find((branch) => branch.name === seed.name)

      const branch = await this.branchService.upsertByName({
        name: seed.name,
        addressText: seed.addressText,
        latitude: seed.latitude,
        longitude: seed.longitude,
        phone: seed.phone,
      })

      if (branch.hours.length === 0) {
        await this.branchService.updateHours(branch.id, seed.hours ?? buildBranchHours(data.hours))
      }

      result.push(branch)

      if (!existing) {
        Logger.log(`sucursal creada: ${branch.name}`, 'Seed')
      }
    }

    return result
  }

  private async seedProducts(
    products: ProductSeed[],
    categories: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<{ createdCount: number; productByName: Map<string, string> }> {
    const { data } = await this.productService.list({ limit: 500, offset: 0 })
    const productByName = new Map(data.map((product) => [product.name, product.id]))
    let createdCount = 0

    for (const seed of products) {
      if (productByName.has(seed.name)) {
        continue
      }

      const category = categories.find((entry) => entry.name === seed.category)
      if (!category) continue

      try {
        const product = await this.productService.create({
          categoryId: category.id,
          name: seed.name,
          description: seed.description,
          price: seed.price,
          image: seed.image,
        })

        for (const group of seed.groups) {
          const createdGroup = await this.productService.addConfigGroup(product.id, {
            name: group.name,
            type: group.type,
            required: group.required,
            min: group.min,
            max: group.max,
          })

          if (!createdGroup) continue

          for (const option of group.options) {
            await this.productService.addConfigOption(product.id, createdGroup.id, {
              name: option.name,
              extraPrice: option.extraPrice,
            })
          }
        }

        const recipe = seed.recipe
          .map((item) => {
            const ingredientId = ingredients.get(item.ingredient)
            return ingredientId ? { ingredientId, quantity: item.quantity } : null
          })
          .filter((item): item is { ingredientId: string; quantity: number } => item !== null)

        if (recipe.length > 0) {
          await this.productService.setRecipe(product.id, recipe)
        }

        productByName.set(seed.name, product.id)
        createdCount += 1
        Logger.log(`producto creado: ${seed.name}`, 'Seed')
      } catch (error: unknown) {
        if (isDuplicateKeyError(error)) continue
        throw error
      }
    }

    return { createdCount, productByName }
  }

  private resolveNamesToIds(names: string[] | undefined, map: Map<string, string>): string[] {
    if (!names || names.length === 0) return []
    return names.map((name) => map.get(name)).filter((id): id is string => id !== undefined)
  }

  private async seedPromotions(
    promotions: PromotionSeed[],
    categories: { id: string; name: string }[],
    branches: { id: string; name: string }[],
    productByName: Map<string, string>,
  ): Promise<number> {
    const now = Date.now()
    const { data } = await this.promotionService.list({ limit: 500, offset: 0 })
    let createdCount = 0

    const categoryByName = new Map(categories.map((c) => [c.name, c.id]))
    const branchByName = new Map(branches.map((b) => [b.name, b.id]))

    for (const seed of promotions) {
      if (data.find((promotion) => promotion.name === seed.name)) continue

      const requestedCategories = [
        ...(seed.categoryName ? [seed.categoryName] : []),
        ...(seed.categoryNames ?? []),
      ]
      const categoryIds = this.resolveNamesToIds(requestedCategories, categoryByName)
      const productIds = this.resolveNamesToIds(seed.productNames, productByName)
      const branchIds = this.resolveNamesToIds(seed.branchNames, branchByName)

      await this.promotionService.upsertByName({
        name: seed.name,
        description: seed.description,
        type: seed.type,
        scope: seed.scope,
        discountValue: seed.discountValue,
        maxDiscount: seed.maxDiscount,
        buyQuantity: seed.buyQuantity,
        payQuantity: seed.payQuantity,
        categoryIds,
        productIds,
        branchIds,
        code: seed.code,
        minSubtotal: seed.minSubtotal ?? 0,
        minQuantity: seed.minQuantity ?? 0,
        maxUsesTotal: seed.maxUsesTotal,
        maxUsesPerCustomer: seed.maxUsesPerCustomer,
        daysOfWeek: seed.daysOfWeek ?? [],
        startTime: seed.startTime ?? null,
        endTime: seed.endTime ?? null,
        stackable: seed.stackable ?? false,
        priority: seed.priority ?? 0,
        startDate: new Date(now - 24 * 60 * 60 * 1000),
        endDate: new Date(now + 365 * 24 * 60 * 60 * 1000),
        active: seed.active ?? true,
      })
      createdCount += 1
      Logger.log(`promoción creada: ${seed.name}`, 'Seed')
    }

    return createdCount
  }

  private async seedStock(
    branches: { id: string; name: string }[],
    ingredients: Map<string, string>,
  ): Promise<number> {
    let createdCount = 0
    const ingredientIds = [...ingredients.values()]

    for (const branch of branches) {
      const existing = await this.stockService.list(branch.id)
      const existingIngredientIds = new Set(existing.map((row) => row.ingredientId))

      for (const ingredientId of ingredientIds) {
        if (existingIngredientIds.has(ingredientId)) continue
        await this.stockService.adjust(branch.id, ingredientId, 20)
        createdCount += 1
      }
    }

    if (createdCount > 0) {
      Logger.log(`stock inicial creado: ${createdCount} filas`, 'Seed')
    }

    return createdCount
  }

  private loadData(): CommerceSeedData {
    return loadSeedData<CommerceSeedData>('commerce', { baseDir: DATA_DIR })
  }

  private loadDemoConfig(): DemoSeedConfig {
    return loadSeedData<DemoSeedConfig>('commerce.demo', { baseDir: DATA_DIR })
  }
}
