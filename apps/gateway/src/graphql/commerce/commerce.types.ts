import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql'
import { User } from '../auth/auth.types'
import { ConfigGroupType, configGroupTypeFromRest } from '../common/config-group-type.enum'
import {
  asBoolean,
  asNumber,
  asRecordList,
  asString,
  asStringList,
  idOf,
  nullableNumber,
  nullableString,
} from '../common/mappers'
import type { RawRecord } from '../common/mappers'
import { OrderStatus, orderStatusFromRest } from '../common/order-status.enum'

@ObjectType()
export class Category {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class ConfigOption {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => Float)
  extraPrice!: number

  @Field()
  available!: boolean
}

@ObjectType()
export class ConfigGroup {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => ConfigGroupType)
  type!: ConfigGroupType

  @Field()
  required!: boolean

  @Field(() => Int, { nullable: true })
  min!: number | null

  @Field(() => Int, { nullable: true })
  max!: number | null

  @Field(() => [ConfigOption])
  options!: ConfigOption[]
}

@ObjectType()
export class Ingredient {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  unit!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class RecipeItem {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  ingredientId!: string

  @Field(() => Ingredient, { nullable: true })
  ingredient?: Ingredient | null

  @Field(() => Float)
  quantity!: number
}

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  categoryId!: string

  @Field(() => Category, { nullable: true })
  category?: Category | null

  @Field()
  name!: string

  @Field()
  description!: string

  @Field(() => Float)
  price!: number

  @Field(() => String, { nullable: true })
  image!: string | null

  @Field()
  available!: boolean

  @Field(() => [ConfigGroup])
  configGroups!: ConfigGroup[]

  @Field(() => [RecipeItem])
  recipe!: RecipeItem[]
}

@ObjectType()
export class Promotion {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field(() => String, { nullable: true })
  description!: string | null

  @Field()
  startDate!: string

  @Field()
  endDate!: string

  @Field()
  active!: boolean
}

@ObjectType()
export class BranchHours {
  @Field(() => Int)
  dayOfWeek!: number

  @Field(() => String, { nullable: true })
  opening!: string | null

  @Field(() => String, { nullable: true })
  closing!: string | null

  @Field()
  closed!: boolean
}

@ObjectType()
export class Branch {
  @Field(() => ID)
  id!: string

  @Field()
  name!: string

  @Field()
  addressText!: string

  @Field(() => Float)
  latitude!: number

  @Field(() => Float)
  longitude!: number

  @Field(() => String, { nullable: true })
  phone!: string | null

  @Field()
  active!: boolean

  @Field(() => [BranchHours])
  hours!: BranchHours[]
}

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  productId!: string

  @Field(() => Product, { nullable: true })
  product?: Product | null

  @Field(() => Int)
  quantity!: number

  @Field(() => String, { nullable: true })
  observations!: string | null

  @Field(() => [ID])
  optionIds!: string[]

  @Field(() => [ConfigOption])
  options!: ConfigOption[]
}

@ObjectType()
export class Cart {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  clientId!: string

  @Field()
  status!: string

  @Field(() => [CartItem])
  items!: CartItem[]

  @Field(() => Float)
  total!: number
}

@ObjectType()
export class OrderItemOption {
  @Field(() => ID)
  optionId!: string

  @Field()
  name!: string

  @Field(() => Float)
  extraPrice!: number
}

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  productId!: string

  @Field()
  name!: string

  @Field(() => Float)
  unitPrice!: number

  @Field(() => Int)
  quantity!: number

  @Field(() => String, { nullable: true })
  observations!: string | null

  @Field(() => Float)
  subtotal!: number

  @Field(() => [OrderItemOption])
  options!: OrderItemOption[]
}

@ObjectType()
export class OrderStatusHistory {
  @Field(() => OrderStatus)
  previousStatus!: OrderStatus

  @Field(() => OrderStatus)
  newStatus!: OrderStatus

  @Field()
  changedAt!: string
}

@ObjectType()
export class OrderAddress {
  @Field()
  text!: string

  @Field(() => Float)
  latitude!: number

  @Field(() => Float)
  longitude!: number
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string

  @Field()
  number!: string

  @Field(() => ID)
  clientId!: string

  @Field(() => ID, { nullable: true })
  riderId!: string | null

  @Field(() => User, { nullable: true })
  client?: User | null

  @Field(() => ID)
  branchId!: string

  @Field(() => Branch, { nullable: true })
  branch?: Branch | null

  @Field(() => OrderAddress)
  deliveryAddress!: OrderAddress

  @Field(() => OrderStatus)
  status!: OrderStatus

  @Field(() => Float)
  total!: number

  @Field(() => String, { nullable: true })
  estimatedDeliveryAt!: string | null

  @Field()
  createdAt!: string

  @Field(() => [OrderItem])
  items!: OrderItem[]

  @Field(() => [OrderStatusHistory])
  statusHistory!: OrderStatusHistory[]

  @Field(() => [OrderStatus])
  availableTransitions!: OrderStatus[]
}

@ObjectType()
export class RepeatOrderResult {
  @Field(() => Cart)
  cart!: Cart

  @Field(() => [Product])
  skippedProducts!: Product[]
}

@ObjectType()
export class BranchStock {
  @Field(() => ID)
  ingredientId!: string

  @Field(() => Ingredient, { nullable: true })
  ingredient?: Ingredient | null

  @Field(() => ID)
  branchId!: string

  @Field(() => Float)
  quantity!: number
}

@ObjectType()
export class StockMovement {
  @Field(() => ID)
  id!: string

  @Field(() => ID)
  branchId!: string

  @Field(() => ID)
  ingredientId!: string

  @Field(() => Float)
  delta!: number

  @Field()
  reason!: string

  @Field(() => ID, { nullable: true })
  orderId!: string | null

  @Field()
  createdAt!: string
}

@ObjectType()
export class Parameter {
  @Field()
  key!: string

  @Field(() => Float)
  value!: number

  @Field()
  unit!: string
}

@ObjectType()
export class OrderState {
  @Field()
  code!: string

  @Field()
  name!: string

  @Field(() => Int)
  order!: number

  @Field()
  active!: boolean
}

@ObjectType()
export class ProductReportRow {
  @Field(() => Int)
  position!: number

  @Field(() => Product)
  product!: Product

  @Field(() => Category, { nullable: true })
  category!: Category | null

  @Field(() => Int, { nullable: true })
  quantity!: number | null

  @Field(() => Float, { nullable: true })
  revenue!: number | null
}

@ObjectType()
export class OutOfStockRow {
  @Field(() => Product)
  product!: Product

  @Field(() => Category, { nullable: true })
  category!: Category | null

  @Field(() => Float)
  quantity!: number
}

@ObjectType()
export class ReportPeriod {
  @Field()
  from!: string

  @Field()
  to!: string
}

@ObjectType()
export class ProductSalesRow {
  @Field(() => ID)
  productId!: string

  @Field()
  name!: string

  @Field(() => Int)
  quantity!: number

  @Field(() => Float)
  revenue!: number
}

@ObjectType()
export class BranchPerformanceRow {
  @Field(() => ID)
  branchId!: string

  @Field()
  branchName!: string

  @Field(() => Float)
  revenue!: number

  @Field(() => Int)
  orders!: number
}

@ObjectType()
export class ReportKpis {
  @Field(() => Float)
  totalRevenue!: number

  @Field(() => Int)
  totalOrders!: number

  @Field(() => Float)
  averageTicket!: number

  @Field(() => Int)
  cancelledOrders!: number

  @Field(() => ProductSalesRow, { nullable: true })
  bestSellingProduct!: ProductSalesRow | null

  @Field(() => BranchPerformanceRow, { nullable: true })
  topBranch!: BranchPerformanceRow | null
}

@ObjectType()
export class ReportVariation {
  @Field(() => Float, { nullable: true })
  revenuePct!: number | null

  @Field(() => Float, { nullable: true })
  ordersPct!: number | null

  @Field(() => Float, { nullable: true })
  averageTicketPct!: number | null
}

@ObjectType()
export class SalesSeriesPoint {
  @Field()
  bucket!: string

  @Field(() => Float)
  revenue!: number

  @Field(() => Int)
  orders!: number
}

@ObjectType()
export class OrderStatusCount {
  @Field(() => OrderStatus)
  status!: OrderStatus

  @Field(() => Int)
  count!: number
}

@ObjectType()
export class ReportsOverview {
  @Field(() => ReportPeriod)
  period!: ReportPeriod

  @Field(() => ReportKpis)
  kpis!: ReportKpis

  @Field(() => ReportVariation)
  variation!: ReportVariation

  @Field(() => [SalesSeriesPoint])
  salesSeries!: SalesSeriesPoint[]

  @Field(() => [OrderStatusCount])
  ordersByStatus!: OrderStatusCount[]

  @Field(() => [ProductSalesRow])
  topProducts!: ProductSalesRow[]

  @Field(() => [BranchPerformanceRow])
  branchPerformance!: BranchPerformanceRow[]
}

@ObjectType()
export class CustomerBranchRow {
  @Field(() => ID)
  branchId!: string

  @Field()
  branchName!: string

  @Field(() => Int)
  orders!: number

  @Field(() => Float)
  totalSpent!: number
}

@ObjectType()
export class CustomerReportSummary {
  @Field(() => Int)
  totalOrders!: number

  @Field(() => Int)
  completedOrders!: number

  @Field(() => Int)
  cancelledOrders!: number

  @Field(() => Int)
  activeOrders!: number

  @Field(() => Float)
  totalSpent!: number

  @Field(() => Float)
  averageTicket!: number

  @Field(() => CustomerBranchRow, { nullable: true })
  favoriteBranch!: CustomerBranchRow | null
}

@ObjectType()
export class CustomerActivityPoint {
  @Field()
  bucket!: string

  @Field(() => Int)
  orders!: number

  @Field(() => Int)
  completedOrders!: number

  @Field(() => Float)
  totalSpent!: number
}

@ObjectType()
export class CustomerProductRow {
  @Field(() => ID)
  productId!: string

  @Field()
  name!: string

  @Field(() => Int)
  quantity!: number

  @Field(() => Int)
  orders!: number

  @Field(() => Float)
  totalSpent!: number
}

@ObjectType()
export class CustomerReportsOverview {
  @Field(() => ReportPeriod)
  period!: ReportPeriod

  @Field(() => CustomerReportSummary)
  summary!: CustomerReportSummary

  @Field(() => [CustomerActivityPoint])
  activitySeries!: CustomerActivityPoint[]

  @Field(() => [CustomerProductRow])
  frequentProducts!: CustomerProductRow[]

  @Field(() => [OrderStatusCount])
  ordersByStatus!: OrderStatusCount[]
}

@ObjectType()
export class CustomerInsightsKpis {
  @Field(() => Int)
  totalBuyers!: number

  @Field(() => Int)
  newBuyers!: number

  @Field(() => Int)
  returningBuyers!: number

  @Field(() => Int)
  recurringBuyers!: number

  @Field(() => Int)
  totalOrders!: number

  @Field(() => Float)
  totalSpent!: number

  @Field(() => Float)
  averageTicket!: number

  @Field(() => Float)
  averageOrdersPerBuyer!: number
}

@ObjectType()
export class CustomerBuyerSeriesPoint {
  @Field()
  bucket!: string

  @Field(() => Int)
  buyers!: number
}

@ObjectType()
export class CustomerDistributionRow {
  @Field()
  bucket!: string

  @Field()
  label!: string

  @Field(() => Int)
  buyers!: number
}

@ObjectType()
export class CustomerBranchActivityRow {
  @Field(() => ID)
  branchId!: string

  @Field()
  branchName!: string

  @Field(() => Int)
  buyers!: number

  @Field(() => Int)
  orders!: number

  @Field(() => Float)
  totalSpent!: number
}

@ObjectType()
export class CustomerInsightsRow {
  @Field(() => ID)
  clientId!: string

  @Field(() => User, { nullable: true })
  client?: User | null

  @Field(() => Int)
  orders!: number

  @Field(() => Float)
  totalSpent!: number

  @Field()
  firstPurchaseAt!: string

  @Field()
  lastPurchaseAt!: string

  @Field(() => Int)
  daysSinceLastPurchase!: number

  @Field()
  isNew!: boolean

  @Field()
  isNewOnPlatform!: boolean

  @Field()
  isRecurring!: boolean
}

@ObjectType()
export class CustomerInsightsOverview {
  @Field(() => ReportPeriod)
  period!: ReportPeriod

  @Field(() => CustomerInsightsKpis)
  kpis!: CustomerInsightsKpis

  @Field(() => [CustomerBuyerSeriesPoint])
  buyerSeries!: CustomerBuyerSeriesPoint[]

  @Field(() => [CustomerDistributionRow])
  frequency!: CustomerDistributionRow[]

  @Field(() => [CustomerDistributionRow])
  recency!: CustomerDistributionRow[]

  @Field(() => [CustomerBranchActivityRow])
  branchActivity!: CustomerBranchActivityRow[]

  @Field(() => [CustomerInsightsRow])
  customers!: CustomerInsightsRow[]
}

@ObjectType()
export class CustomerRegistrationStats {
  @Field(() => Int)
  total!: number

  @Field(() => Int)
  newInPeriod!: number
}

const asStatusList = (value: unknown): OrderStatus[] =>
  Array.isArray(value) ? value.map((entry) => orderStatusFromRest(asString(entry))) : []

export const mapCategory = (raw: RawRecord): Category => ({
  id: idOf(raw),
  name: asString(raw.name),
  active: asBoolean(raw.active),
})

export const mapConfigOption = (raw: RawRecord): ConfigOption => ({
  id: idOf(raw),
  name: asString(raw.name),
  extraPrice: asNumber(raw.extraPrice),
  available: asBoolean(raw.available),
})

export const mapConfigGroup = (raw: RawRecord): ConfigGroup => ({
  id: idOf(raw),
  name: asString(raw.name),
  type: configGroupTypeFromRest(asString(raw.type)),
  required: asBoolean(raw.required),
  min: raw.min == null ? null : asNumber(raw.min),
  max: raw.max == null ? null : asNumber(raw.max),
  options: asRecordList(raw.options).map(mapConfigOption),
})

export const mapRecipeItem = (raw: RawRecord): RecipeItem => ({
  id: idOf(raw),
  ingredientId: asString(raw.ingredientId),
  quantity: asNumber(raw.quantity),
})

export const mapIngredient = (raw: RawRecord): Ingredient => ({
  id: idOf(raw),
  name: asString(raw.name),
  unit: asString(raw.unit),
  active: asBoolean(raw.active),
})

export const mapProduct = (raw: RawRecord): Product => ({
  id: idOf(raw),
  categoryId: asString(raw.categoryId),
  name: asString(raw.name),
  description: asString(raw.description),
  price: asNumber(raw.price),
  image: nullableString(raw.image),
  available: asBoolean(raw.available),
  configGroups: asRecordList(raw.configGroups).map(mapConfigGroup),
  recipe: asRecordList(raw.recipe).map(mapRecipeItem),
})

export const mapPromotion = (raw: RawRecord): Promotion => ({
  id: idOf(raw),
  name: asString(raw.name),
  description: nullableString(raw.description),
  startDate: asString(raw.startDate),
  endDate: asString(raw.endDate),
  active: asBoolean(raw.active),
})

export const mapBranchHour = (raw: RawRecord): BranchHours => ({
  dayOfWeek: asNumber(raw.dayOfWeek),
  opening: nullableString(raw.opening),
  closing: nullableString(raw.closing),
  closed: asBoolean(raw.closed),
})

export const mapBranch = (raw: RawRecord): Branch => ({
  id: idOf(raw),
  name: asString(raw.name),
  addressText: asString(raw.addressText),
  latitude: asNumber(raw.latitude),
  longitude: asNumber(raw.longitude),
  phone: nullableString(raw.phone),
  active: asBoolean(raw.active),
  hours: asRecordList(raw.hours).map(mapBranchHour),
})

export const mapCartItem = (raw: RawRecord): CartItem => ({
  id: idOf(raw),
  productId: asString(raw.productId),
  quantity: asNumber(raw.quantity),
  observations: nullableString(raw.observations),
  optionIds: asStringList(raw.optionIds),
  options: [],
})

export const mapCart = (raw: RawRecord): Cart => ({
  id: idOf(raw),
  clientId: asString(raw.clientId),
  status: asString(raw.status),
  items: asRecordList(raw.items).map(mapCartItem),
  total: asNumber(raw.total),
})

export const mapOrderItemOption = (raw: RawRecord): OrderItemOption => ({
  optionId: asString(raw.optionId),
  name: asString(raw.name),
  extraPrice: asNumber(raw.extraPrice),
})

export const mapOrderItem = (raw: RawRecord): OrderItem => ({
  productId: asString(raw.productId),
  name: asString(raw.name),
  unitPrice: asNumber(raw.unitPrice),
  quantity: asNumber(raw.quantity),
  observations: nullableString(raw.observations),
  subtotal: asNumber(raw.subtotal),
  options: asRecordList(raw.options).map(mapOrderItemOption),
})

export const mapOrderStatusHistory = (raw: RawRecord): OrderStatusHistory => ({
  previousStatus: orderStatusFromRest(asString(raw.previousStatus)),
  newStatus: orderStatusFromRest(asString(raw.newStatus)),
  changedAt: asString(raw.changedAt),
})

export const mapOrder = (raw: RawRecord): Order => ({
  id: idOf(raw),
  number: asString(raw.number),
  clientId: asString(raw.clientId),
  riderId: nullableString(raw.riderId),
  branchId: asString(raw.branchId),
  deliveryAddress: {
    text: asString((raw.deliveryAddress as RawRecord | undefined)?.text),
    latitude: asNumber((raw.deliveryAddress as RawRecord | undefined)?.latitude),
    longitude: asNumber((raw.deliveryAddress as RawRecord | undefined)?.longitude),
  },
  status: orderStatusFromRest(asString(raw.status)),
  total: asNumber(raw.total),
  estimatedDeliveryAt: nullableString(raw.estimatedDeliveryAt),
  createdAt: asString(raw.createdAt),
  items: asRecordList(raw.items).map(mapOrderItem),
  statusHistory: asRecordList(raw.statusHistory).map(mapOrderStatusHistory),
  availableTransitions: asStatusList(raw.availableTransitions),
})

export const mapBranchStock = (raw: RawRecord): BranchStock => ({
  ingredientId: asString(raw.ingredientId),
  branchId: asString(raw.branchId),
  quantity: asNumber(raw.quantity),
})

export const mapStockMovement = (raw: RawRecord): StockMovement => ({
  id: idOf(raw),
  branchId: asString(raw.branchId),
  ingredientId: asString(raw.ingredientId),
  delta: asNumber(raw.delta),
  reason: asString(raw.reason),
  orderId: nullableString(raw.orderId),
  createdAt: asString(raw.createdAt),
})

export const mapParameter = (raw: RawRecord): Parameter => ({
  key: asString(raw.key),
  value: asNumber(raw.value),
  unit: asString(raw.unit),
})

export const mapOrderState = (raw: RawRecord): OrderState => ({
  code: asString(raw.code),
  name: asString(raw.name),
  order: asNumber(raw.order),
  active: asBoolean(raw.active),
})

export const mapProductReportRow = (raw: RawRecord): ProductReportRow => ({
  position: asNumber(raw.position),
  product: mapProduct(raw.product as RawRecord),
  category: raw.category ? mapCategory(raw.category as RawRecord) : null,
  quantity: raw.quantity == null ? null : asNumber(raw.quantity),
  revenue: raw.revenue == null ? null : asNumber(raw.revenue),
})

export const mapOutOfStockRow = (raw: RawRecord): OutOfStockRow => ({
  product: mapProduct(raw.product as RawRecord),
  category: raw.category ? mapCategory(raw.category as RawRecord) : null,
  quantity: asNumber(raw.quantity),
})

export const mapProductSalesRow = (raw: RawRecord): ProductSalesRow => ({
  productId: asString(raw.productId),
  name: asString(raw.name),
  quantity: asNumber(raw.quantity),
  revenue: asNumber(raw.revenue),
})

export const mapBranchPerformanceRow = (raw: RawRecord): BranchPerformanceRow => ({
  branchId: asString(raw.branchId),
  branchName: asString(raw.branchName),
  revenue: asNumber(raw.revenue),
  orders: asNumber(raw.orders),
})

export const mapReportVariation = (raw: RawRecord): ReportVariation => ({
  revenuePct: nullableNumber(raw.revenuePct),
  ordersPct: nullableNumber(raw.ordersPct),
  averageTicketPct: nullableNumber(raw.averageTicketPct),
})

export const mapReportsOverview = (raw: RawRecord): ReportsOverview => {
  const period = (raw.period as RawRecord | undefined) ?? {}
  const kpis = (raw.kpis as RawRecord | undefined) ?? {}

  return {
    period: { from: asString(period.from), to: asString(period.to) },
    kpis: {
      totalRevenue: asNumber(kpis.totalRevenue),
      totalOrders: asNumber(kpis.totalOrders),
      averageTicket: asNumber(kpis.averageTicket),
      cancelledOrders: asNumber(kpis.cancelledOrders),
      bestSellingProduct: kpis.bestSellingProduct
        ? mapProductSalesRow(kpis.bestSellingProduct as RawRecord)
        : null,
      topBranch: kpis.topBranch ? mapBranchPerformanceRow(kpis.topBranch as RawRecord) : null,
    },
    variation: mapReportVariation((raw.variation as RawRecord | undefined) ?? {}),
    salesSeries: asRecordList(raw.salesSeries).map((entry) => ({
      bucket: asString(entry.bucket),
      revenue: asNumber(entry.revenue),
      orders: asNumber(entry.orders),
    })),
    ordersByStatus: asRecordList(raw.ordersByStatus).map((entry) => ({
      status: orderStatusFromRest(asString(entry.status)),
      count: asNumber(entry.count),
    })),
    topProducts: asRecordList(raw.topProducts).map(mapProductSalesRow),
    branchPerformance: asRecordList(raw.branchPerformance).map(mapBranchPerformanceRow),
  }
}

export const mapCustomerBranchRow = (raw: RawRecord): CustomerBranchRow => ({
  branchId: asString(raw.branchId),
  branchName: asString(raw.branchName),
  orders: asNumber(raw.orders),
  totalSpent: asNumber(raw.totalSpent),
})

export const mapCustomerInsightsOverview = (raw: RawRecord): CustomerInsightsOverview => {
  const period = (raw.period as RawRecord | undefined) ?? {}
  const kpis = (raw.kpis as RawRecord | undefined) ?? {}

  return {
    period: { from: asString(period.from), to: asString(period.to) },
    kpis: {
      totalBuyers: asNumber(kpis.totalBuyers),
      newBuyers: asNumber(kpis.newBuyers),
      returningBuyers: asNumber(kpis.returningBuyers),
      recurringBuyers: asNumber(kpis.recurringBuyers),
      totalOrders: asNumber(kpis.totalOrders),
      totalSpent: asNumber(kpis.totalSpent),
      averageTicket: asNumber(kpis.averageTicket),
      averageOrdersPerBuyer: asNumber(kpis.averageOrdersPerBuyer),
    },
    buyerSeries: asRecordList(raw.buyerSeries).map((entry) => ({
      bucket: asString(entry.bucket),
      buyers: asNumber(entry.buyers),
    })),
    frequency: asRecordList(raw.frequency).map((entry) => ({
      bucket: asString(entry.bucket),
      label: asString(entry.label),
      buyers: asNumber(entry.buyers),
    })),
    recency: asRecordList(raw.recency).map((entry) => ({
      bucket: asString(entry.bucket),
      label: asString(entry.label),
      buyers: asNumber(entry.buyers),
    })),
    branchActivity: asRecordList(raw.branchActivity).map((entry) => ({
      branchId: asString(entry.branchId),
      branchName: asString(entry.branchName),
      buyers: asNumber(entry.buyers),
      orders: asNumber(entry.orders),
      totalSpent: asNumber(entry.totalSpent),
    })),
    customers: asRecordList(raw.customers).map((entry) => ({
      clientId: asString(entry.clientId),
      orders: asNumber(entry.orders),
      totalSpent: asNumber(entry.totalSpent),
      firstPurchaseAt: asString(entry.firstPurchaseAt),
      lastPurchaseAt: asString(entry.lastPurchaseAt),
      daysSinceLastPurchase: asNumber(entry.daysSinceLastPurchase),
      isNew: asBoolean(entry.isNew),
      isNewOnPlatform: asBoolean(entry.isNewOnPlatform),
      isRecurring: asBoolean(entry.isRecurring),
    })),
  }
}

export const mapCustomerRegistrationStats = (raw: RawRecord): CustomerRegistrationStats => ({
  total: asNumber(raw.total),
  newInPeriod: asNumber(raw.newInPeriod),
})

export const mapCustomerReportsOverview = (raw: RawRecord): CustomerReportsOverview => {
  const period = (raw.period as RawRecord | undefined) ?? {}
  const summary = (raw.summary as RawRecord | undefined) ?? {}

  return {
    period: { from: asString(period.from), to: asString(period.to) },
    summary: {
      totalOrders: asNumber(summary.totalOrders),
      completedOrders: asNumber(summary.completedOrders),
      cancelledOrders: asNumber(summary.cancelledOrders),
      activeOrders: asNumber(summary.activeOrders),
      totalSpent: asNumber(summary.totalSpent),
      averageTicket: asNumber(summary.averageTicket),
      favoriteBranch: summary.favoriteBranch
        ? mapCustomerBranchRow(summary.favoriteBranch as RawRecord)
        : null,
    },
    activitySeries: asRecordList(raw.activitySeries).map((entry) => ({
      bucket: asString(entry.bucket),
      orders: asNumber(entry.orders),
      completedOrders: asNumber(entry.completedOrders),
      totalSpent: asNumber(entry.totalSpent),
    })),
    frequentProducts: asRecordList(raw.frequentProducts).map((entry) => ({
      productId: asString(entry.productId),
      name: asString(entry.name),
      quantity: asNumber(entry.quantity),
      orders: asNumber(entry.orders),
      totalSpent: asNumber(entry.totalSpent),
    })),
    ordersByStatus: asRecordList(raw.ordersByStatus).map((entry) => ({
      status: orderStatusFromRest(asString(entry.status)),
      count: asNumber(entry.count),
    })),
  }
}
