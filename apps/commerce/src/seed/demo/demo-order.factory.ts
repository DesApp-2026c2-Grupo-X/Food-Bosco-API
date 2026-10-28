import type { PublicBranch } from '../../branch/branch.model'
import { OrderStatus, ORDER_STATUS } from '../../config/constants'
import { haversineDistanceKm } from '../../config/geo/distance'
import type { PublicProduct } from '../../product/product.model'
import type { SeededRandom } from '@repo/seed-utils'
import { localDateAt, localDayOfWeek, minutesBetween } from '@repo/seed-utils'

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

/** Pesos por día de la semana (0 = domingo … 6 = sábado). */
const WEEKDAY_WEIGHTS = [1.2, 0.7, 0.8, 0.9, 1.0, 1.3, 1.35]

const ITEM_OBSERVATIONS = [
  'Sin cebolla',
  'Bien cocida',
  'Sin sal',
  'Con extra de salsa',
  'Para llevar',
  'Tocar timbre',
]

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
  [ORDER_STATUS.cancelled]: [],
}

const STATUS_OFFSETS: Record<OrderStatus, number> = {
  [ORDER_STATUS.pending]: 0,
  [ORDER_STATUS.confirmed]: 4,
  [ORDER_STATUS.preparing]: 12,
  [ORDER_STATUS.readyForDelivery]: 30,
  [ORDER_STATUS.onTheWay]: 40,
  [ORDER_STATUS.delivered]: 65,
  [ORDER_STATUS.cancelled]: 10,
}

/** Los primeros pedidos garantizan que exista al menos uno de cada estado. */
const FORCED_ORDERS: { status: OrderStatus; minutesAgo: number }[] = [
  { status: ORDER_STATUS.pending, minutesAgo: 4 },
  { status: ORDER_STATUS.confirmed, minutesAgo: 12 },
  { status: ORDER_STATUS.preparing, minutesAgo: 25 },
  { status: ORDER_STATUS.readyForDelivery, minutesAgo: 45 },
  { status: ORDER_STATUS.onTheWay, minutesAgo: 75 },
  { status: ORDER_STATUS.delivered, minutesAgo: 150 },
  { status: ORDER_STATUS.cancelled, minutesAgo: 90 },
]

export interface DemoAddressInput {
  id: string
  text: string
  latitude: number
  longitude: number
}

export interface DemoCustomerInput {
  id: string
  addresses: DemoAddressInput[]
}

export interface DemoOrderConfig {
  orders: number
  days: number
  recentDays: number
  recentShare: number
  cancelRate: number
  oldestPriceFactor: number
  maxItems: number
  maxQuantity: number
  heavyCustomerEvery: number
  heavyCustomerWeight: number
  productWeights: Record<string, number>
}

export interface PlannedOrderItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  observations: string | null
  subtotal: number
  options: { optionId: string; name: string; extraPrice: number }[]
}

export interface PlannedStatusHistory {
  previousStatus: OrderStatus
  newStatus: OrderStatus
  changedAt: Date
}

export interface PlannedOrder {
  clientId: string
  branchId: string
  addressId: string
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: OrderStatus
  total: number
  estimatedDeliveryAt: Date
  items: PlannedOrderItem[]
  statusHistory: PlannedStatusHistory[]
  createdAt: Date
}

export interface BuildDemoOrdersInput {
  customers: DemoCustomerInput[]
  products: PublicProduct[]
  branches: PublicBranch[]
  config: DemoOrderConfig
  random: SeededRandom
  now: Date
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const pickDaysAgo = (random: SeededRandom, config: DemoOrderConfig, now: Date): number => {
  const isRecent = random.chance(config.recentShare)
  const min = isRecent ? 0 : config.recentDays
  const max = isRecent
    ? Math.max(0, config.recentDays - 1)
    : Math.max(config.recentDays, config.days - 1)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const daysAgo = random.int(min, max)
    const weight = WEEKDAY_WEIGHTS[localDayOfWeek(now, daysAgo)] / WEEKDAY_WEIGHTS[6]
    if (random.next() <= weight) return daysAgo
  }

  return random.int(min, max)
}

const pickMinutesOfDay = (random: SeededRandom): number => {
  const roll = random.next()
  if (roll < 0.35) return random.int(11 * 60 + 30, 14 * 60 + 30)
  if (roll < 0.7) return random.int(19 * 60, 23 * 60)
  if (roll < 0.9) return random.int(15 * 60, 18 * 60 + 30)
  return random.int(9 * 60, 11 * 60)
}

const chooseStatus = (
  random: SeededRandom,
  ageMinutes: number,
  config: DemoOrderConfig,
): OrderStatus => {
  if (ageMinutes > 360) {
    return random.chance(config.cancelRate) ? ORDER_STATUS.cancelled : ORDER_STATUS.delivered
  }

  if (ageMinutes > 90) {
    return random.weighted([
      { value: ORDER_STATUS.delivered, weight: 6 },
      { value: ORDER_STATUS.onTheWay, weight: 3 },
      { value: ORDER_STATUS.readyForDelivery, weight: 1 },
    ])
  }

  if (ageMinutes > 30) {
    return random.weighted([
      { value: ORDER_STATUS.delivered, weight: 3 },
      { value: ORDER_STATUS.onTheWay, weight: 2 },
      { value: ORDER_STATUS.readyForDelivery, weight: 3 },
      { value: ORDER_STATUS.preparing, weight: 1.5 },
      { value: ORDER_STATUS.confirmed, weight: 0.5 },
    ])
  }

  return random.weighted([
    { value: ORDER_STATUS.pending, weight: 2 },
    { value: ORDER_STATUS.confirmed, weight: 2 },
    { value: ORDER_STATUS.preparing, weight: 2 },
    { value: ORDER_STATUS.readyForDelivery, weight: 1.5 },
    { value: ORDER_STATUS.onTheWay, weight: 1 },
  ])
}

const cancelledPath = (random: SeededRandom): OrderStatus[] =>
  random.chance(0.5) ? [ORDER_STATUS.cancelled] : [ORDER_STATUS.confirmed, ORDER_STATUS.cancelled]

const buildStatusHistory = (
  status: OrderStatus,
  createdAt: Date,
  now: Date,
  random: SeededRandom,
): PlannedStatusHistory[] => {
  const path = status === ORDER_STATUS.cancelled ? cancelledPath(random) : STATUS_PATHS[status]
  const offsets =
    status === ORDER_STATUS.cancelled
      ? path.map(() => STATUS_OFFSETS[ORDER_STATUS.cancelled])
      : path.map((step) => STATUS_OFFSETS[step])

  const ageMinutes = Math.max(1, minutesBetween(createdAt, now))
  const totalMinutes = offsets.reduce((sum, value) => sum + value, 0)
  const factor = totalMinutes > ageMinutes ? clamp((ageMinutes * 0.8) / totalMinutes, 0.05, 1) : 1

  const history: PlannedStatusHistory[] = [
    {
      previousStatus: ORDER_STATUS.pending,
      newStatus: ORDER_STATUS.pending,
      changedAt: createdAt,
    },
  ]

  let previous: OrderStatus = ORDER_STATUS.pending
  let elapsed = 0

  for (const [index, step] of path.entries()) {
    elapsed += Math.max(1, Math.round(offsets[index] * factor))
    const changedAt = new Date(
      Math.min(createdAt.getTime() + elapsed * MINUTE_MS, now.getTime() - MINUTE_MS),
    )

    history.push({ previousStatus: previous, newStatus: step, changedAt })
    previous = step
  }

  return history
}

const priceFactor = (daysAgo: number, config: DemoOrderConfig): number =>
  1 - (1 - config.oldestPriceFactor) * clamp(daysAgo / config.days, 0, 1)

const pickOptions = (product: PublicProduct, random: SeededRandom): PlannedOrderItem['options'] =>
  product.configGroups.flatMap((group) => {
    const available = group.options.filter((option) => option.available)
    if (available.length === 0) return []

    const min = group.required ? Math.max(1, group.min ?? 1) : 0
    const max = Math.min(group.max ?? available.length, available.length)
    if (max < min) return []

    const target = random.int(min, max)
    const pool = [...available]
    const chosen: PlannedOrderItem['options'] = []

    while (chosen.length < target && pool.length > 0) {
      const [option] = pool.splice(random.int(0, pool.length - 1), 1)
      chosen.push({ optionId: option.id, name: option.name, extraPrice: option.extraPrice })
    }

    return chosen
  })

const buildItems = (
  products: PublicProduct[],
  random: SeededRandom,
  config: DemoOrderConfig,
  daysAgo: number,
): PlannedOrderItem[] => {
  if (products.length === 0) return []

  const factor = priceFactor(daysAgo, config)
  const entries = products.map((product) => ({
    value: product,
    weight: config.productWeights[product.name] ?? 1,
  }))

  const lineCount = random.int(1, Math.max(1, config.maxItems))
  const chosen = new Map<string, PublicProduct>()

  for (let attempt = 0; attempt < lineCount * 6 && chosen.size < lineCount; attempt += 1) {
    const product = random.weighted(entries)
    if (!chosen.has(product.id)) chosen.set(product.id, product)
  }

  return [...chosen.values()].map((product) => {
    const options = pickOptions(product, random)
    const extras = options.reduce((sum, option) => sum + option.extraPrice, 0)
    const unitPrice = Math.round(product.price * factor) + extras
    const quantity = random.chance(0.7) ? 1 : random.int(1, Math.max(1, config.maxQuantity))
    const observations = random.chance(0.12) ? random.pick(ITEM_OBSERVATIONS) : null

    return {
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity,
      observations,
      subtotal: unitPrice * quantity,
      options,
    }
  })
}

const nearestBranch = (address: DemoAddressInput, branches: PublicBranch[]): PublicBranch =>
  branches.reduce((closest, branch) =>
    haversineDistanceKm(address, branch) < haversineDistanceKm(address, closest) ? branch : closest,
  )

const buildOrder = (
  index: number,
  input: BuildDemoOrdersInput,
  customerEntries: { value: DemoCustomerInput; weight: number }[],
): PlannedOrder | null => {
  const { random, config, now, branches, products } = input
  const customer = random.weighted(customerEntries)
  const address = random.pick(customer.addresses)
  const branch = nearestBranch(address, branches)

  const forced = FORCED_ORDERS[index]
  const createdAt = forced
    ? new Date(now.getTime() - forced.minutesAgo * MINUTE_MS)
    : (() => {
        const daysAgo = pickDaysAgo(random, config, now)
        const candidate = localDateAt(now, daysAgo, pickMinutesOfDay(random))
        return candidate.getTime() > now.getTime() - 5 * MINUTE_MS
          ? new Date(candidate.getTime() - DAY_MS)
          : candidate
      })()

  const ageMinutes = minutesBetween(createdAt, now)
  const status = forced?.status ?? chooseStatus(random, ageMinutes, config)
  const items = buildItems(products, random, config, (now.getTime() - createdAt.getTime()) / DAY_MS)

  if (items.length === 0) return null

  return {
    clientId: customer.id,
    branchId: branch.id,
    addressId: address.id,
    deliveryAddress: {
      text: address.text,
      latitude: address.latitude,
      longitude: address.longitude,
    },
    status,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    estimatedDeliveryAt: new Date(createdAt.getTime() + 60 * MINUTE_MS),
    items,
    statusHistory: buildStatusHistory(status, createdAt, now, random),
    createdAt,
  }
}

/**
 * Genera pedidos históricos aleatorios para una corrida de seed.
 *
 * Es una función pura: recibe el azar, la fecha actual y los datos maestros,
 * y devuelve los pedidos listos para insertar. No toca la base de datos.
 */
export const buildDemoOrders = (input: BuildDemoOrdersInput): PlannedOrder[] => {
  const { config, customers, branches, products } = input
  if (customers.length === 0 || branches.length === 0 || products.length === 0) return []

  const customerEntries = customers.map((customer, index) => ({
    value: customer,
    weight:
      config.heavyCustomerEvery > 0 && index % config.heavyCustomerEvery === 0
        ? config.heavyCustomerWeight
        : 1,
  }))

  return Array.from({ length: Math.max(0, config.orders) })
    .map((_, index) => buildOrder(index, input, customerEntries))
    .filter((order): order is PlannedOrder => order !== null)
}
