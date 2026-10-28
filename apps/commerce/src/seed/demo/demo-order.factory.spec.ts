import type { PublicBranch } from '../../branch/branch.model'
import { ORDER_STATUS, ORDER_STATUS_VALUES } from '../../config/constants'
import { haversineDistanceKm } from '../../config/geo/distance'
import type { PublicProduct } from '../../product/product.model'
import { createSeededRandom } from '@repo/seed-utils'
import {
  buildDemoOrders,
  type BuildDemoOrdersInput,
  type DemoOrderConfig,
  type PlannedOrder,
} from './demo-order.factory'

const DAY_MS = 86_400_000
const NOW = new Date('2026-10-27T18:00:00.000Z')

const product = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p-1',
  categoryId: 'c-1',
  name: 'Hamburguesa Clásica',
  description: 'Demo',
  price: 10000,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const branch = (overrides: Partial<PublicBranch> = {}): PublicBranch => ({
  id: 'b-centro',
  name: 'Centro',
  addressText: 'Avenida Arturo Jauretche 1197, Hurlingham',
  latitude: -34.5899585,
  longitude: -58.6332502,
  phone: null,
  active: true,
  hours: [],
  ...overrides,
})

const config = (overrides: Partial<DemoOrderConfig> = {}): DemoOrderConfig => ({
  orders: 40,
  days: 120,
  recentDays: 30,
  recentShare: 0.6,
  cancelRate: 0.08,
  oldestPriceFactor: 0.82,
  maxItems: 1,
  maxQuantity: 1,
  heavyCustomerEvery: 0,
  heavyCustomerWeight: 1,
  productWeights: { 'Hamburguesa Clásica': 1 },
  ...overrides,
})

const customers = [
  {
    id: 'u-centro',
    addresses: [
      {
        id: 'a-centro',
        text: 'Germán Argerich 1333, Hurlingham',
        latitude: -34.5918429,
        longitude: -58.6371925,
      },
    ],
  },
  {
    id: 'u-oeste',
    addresses: [
      {
        id: 'a-oeste',
        text: 'Avenida Rivadavia 18500, Morón',
        latitude: -34.6492342,
        longitude: -58.6240339,
      },
    ],
  },
]

const branches = [
  branch(),
  branch({
    id: 'b-oeste',
    name: 'Oeste',
    addressText: 'Avenida Rivadavia 18500, Morón',
    latitude: -34.6492342,
    longitude: -58.6240339,
  }),
]

const build = (overrides: Partial<BuildDemoOrdersInput> = {}): PlannedOrder[] =>
  buildDemoOrders({
    customers,
    products: [product()],
    branches,
    config: config(),
    random: createSeededRandom(1234),
    now: NOW,
    ...overrides,
  })

describe('buildDemoOrders', () => {
  it('genera la cantidad de pedidos pedida', () => {
    expect(build()).toHaveLength(40)
    expect(build({ config: config({ orders: 7 }) })).toHaveLength(7)
  })

  it('sin clientes, sucursales o productos no genera nada', () => {
    expect(build({ customers: [] })).toEqual([])
    expect(build({ branches: [] })).toEqual([])
    expect(build({ products: [] })).toEqual([])
  })

  it('todos los pedidos tienen items, total coherente y fecha válida', () => {
    const orders = build()

    for (const order of orders) {
      expect(order.items.length).toBeGreaterThanOrEqual(1)
      expect(order.total).toBe(order.items.reduce((sum, item) => sum + item.subtotal, 0))
      expect(order.items.every((item) => item.subtotal === item.unitPrice * item.quantity)).toBe(
        true,
      )
      expect(order.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime())
      expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(NOW.getTime() - 120 * DAY_MS)
      expect(order.estimatedDeliveryAt.getTime()).toBe(order.createdAt.getTime() + 3_600_000)
      expect(ORDER_STATUS_VALUES).toContain(order.status)
    }
  })

  it('garantiza al menos un pedido de cada estado', () => {
    const statuses = new Set(build().map((order) => order.status))

    expect([...statuses].sort()).toEqual([...ORDER_STATUS_VALUES].sort())
  })

  it('los pedidos con más de dos días sólo están entregados o cancelados', () => {
    const oldOrders = build().filter(
      (order) => order.createdAt.getTime() < NOW.getTime() - 2 * DAY_MS,
    )

    expect(oldOrders.length).toBeGreaterThan(0)
    for (const order of oldOrders) {
      expect([ORDER_STATUS.delivered, ORDER_STATUS.cancelled]).toContain(order.status)
    }
  })

  it.each([
    { status: ORDER_STATUS.pending, steps: 0 },
    { status: ORDER_STATUS.confirmed, steps: 1 },
    { status: ORDER_STATUS.preparing, steps: 2 },
    { status: ORDER_STATUS.readyForDelivery, steps: 3 },
    { status: ORDER_STATUS.onTheWay, steps: 4 },
    { status: ORDER_STATUS.delivered, steps: 5 },
  ])('el historial acompaña el estado $status', ({ status, steps }) => {
    const order = build().find((entry) => entry.status === status)
    expect(order).toBeDefined()

    const history = order!.statusHistory
    expect(history[0]).toMatchObject({
      previousStatus: ORDER_STATUS.pending,
      newStatus: ORDER_STATUS.pending,
    })
    expect(history).toHaveLength(steps + 1)
    expect(history[history.length - 1].newStatus).toBe(status)

    const timestamps = history.map((entry) => entry.changedAt.getTime())
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b))
    expect(Math.max(...timestamps)).toBeLessThanOrEqual(NOW.getTime())
  })

  it('el cancelado cierra su historial con canceled', () => {
    const cancelled = build().filter((order) => order.status === ORDER_STATUS.cancelled)
    expect(cancelled.length).toBeGreaterThan(0)

    for (const order of cancelled) {
      const last = order.statusHistory[order.statusHistory.length - 1]
      expect(last.newStatus).toBe(ORDER_STATUS.cancelled)
    }
  })

  it('asigna la sucursal más cercana a la dirección de entrega', () => {
    for (const order of build()) {
      const distances = branches
        .map((entry) => ({
          id: entry.id,
          distance: haversineDistanceKm(
            {
              latitude: order.deliveryAddress.latitude,
              longitude: order.deliveryAddress.longitude,
            },
            entry,
          ),
        }))
        .sort((a, b) => a.distance - b.distance)

      expect(order.branchId).toBe(distances[0].id)
    }
  })

  it('aplica el precio histórico sin superar el precio actual', () => {
    for (const order of build()) {
      const unitPrice = order.items[0].unitPrice
      expect(unitPrice).toBeLessThanOrEqual(10000)
      expect(unitPrice).toBeGreaterThanOrEqual(Math.round(10000 * 0.82))
    }
  })

  it('es determinista con la misma semilla', () => {
    const snapshot = (orders: PlannedOrder[]): unknown[] =>
      orders.map((order) => ({
        status: order.status,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        clientId: order.clientId,
        items: order.items.map((item) => [item.name, item.unitPrice, item.quantity]),
      }))

    expect(snapshot(build())).toEqual(snapshot(build()))
  })

  it('con semillas distintas cambia la secuencia', () => {
    const first = build({ random: createSeededRandom(1) }).map((order) => order.status)
    const second = build({ random: createSeededRandom(2) }).map((order) => order.status)

    expect(first).not.toEqual(second)
  })

  it('respeta la cantidad máxima de ítems y unidades', () => {
    const orders = build({ config: config({ maxItems: 2, maxQuantity: 3 }) })

    for (const order of orders) {
      expect(order.items.length).toBeLessThanOrEqual(2)
      expect(order.items.every((item) => item.quantity <= 3)).toBe(true)
    }
  })
})
