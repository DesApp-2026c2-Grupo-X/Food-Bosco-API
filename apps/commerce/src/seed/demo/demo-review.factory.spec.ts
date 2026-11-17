import { createSeededRandom } from '@repo/seed-utils'
import { ORDER_STATUS, type OrderStatus } from '../../config/constants'
import type { InsertedDemoOrder } from './demo-orders.repository'
import { buildDemoReviews } from './demo-review.factory'

const MINUTE_MS = 60_000
const NOW = new Date('2026-10-27T18:00:00.000Z')

const makeOrder = (
  index: number,
  overrides: Partial<InsertedDemoOrder> = {},
): InsertedDemoOrder => {
  const createdAt = new Date(NOW.getTime() - (index + 1) * 180 * MINUTE_MS)
  const deliveredAt = new Date(createdAt.getTime() + 65 * MINUTE_MS)
  return {
    id: `order-${index}`,
    number: String(index + 1).padStart(6, '0'),
    clientId: `client-${index % 3}`,
    branchId: `branch-${index % 2}`,
    riderId: index % 5 === 0 ? null : `rider-${index % 2}`,
    status: ORDER_STATUS.delivered,
    deliveryAddress: { text: 'Calle 1', latitude: -34.59, longitude: -58.63 },
    createdAt,
    deliveredAt,
    ...overrides,
  }
}

const makeOrders = (count: number): InsertedDemoOrder[] =>
  Array.from({ length: count }, (_, index) => makeOrder(index))

describe('buildDemoReviews', () => {
  it('solo genera reseñas para pedidos delivered y omite el primer pedido delivered', () => {
    const nonDeliveredStatuses: OrderStatus[] = [
      ORDER_STATUS.pending,
      ORDER_STATUS.confirmed,
      ORDER_STATUS.preparing,
      ORDER_STATUS.readyForDelivery,
      ORDER_STATUS.onTheWay,
      ORDER_STATUS.cancelled,
    ]
    const orders: InsertedDemoOrder[] = [
      ...nonDeliveredStatuses.map((status, idx) => makeOrder(idx, { status })),
      ...Array.from({ length: 20 }, (_, idx) => makeOrder(100 + idx)),
    ]

    const reviews = buildDemoReviews({
      orders,
      reviewRate: 1,
      random: createSeededRandom(42),
      now: NOW,
    })

    const orderById = new Map(orders.map((order) => [order.id, order]))
    expect(reviews).toHaveLength(19)
    expect(reviews.some((review) => review.orderId === 'order-100')).toBe(false)
    expect(
      reviews.every((review) => orderById.get(review.orderId)?.status === ORDER_STATUS.delivered),
    ).toBe(true)
  })

  it('respeta la tasa de reseñas dejando pedidos sin calificar', () => {
    const orders = makeOrders(60)
    const reviews = buildDemoReviews({
      orders,
      reviewRate: 0.7,
      random: createSeededRandom(123),
      now: NOW,
    })

    expect(reviews.length).toBeGreaterThan(20)
    expect(reviews.length).toBeLessThan(59)
  })

  it('asigna courierId y courierRating solo cuando order.riderId no es null', () => {
    const orders = makeOrders(40)
    const reviews = buildDemoReviews({
      orders,
      reviewRate: 1,
      random: createSeededRandom(99),
      now: NOW,
    })

    const orderById = new Map(orders.map((order) => [order.id, order]))

    for (const review of reviews) {
      const order = orderById.get(review.orderId)!
      expect(review.branchRating).toBeGreaterThanOrEqual(1)
      expect(review.branchRating).toBeLessThanOrEqual(5)
      expect(Number.isInteger(review.branchRating)).toBe(true)

      if (order.riderId === null) {
        expect(review.courierId).toBeNull()
        expect(review.courierRating).toBeNull()
        expect(review.courierComment).toBeNull()
      } else {
        expect(review.courierId).toBe(order.riderId)
        expect(review.courierRating).toBeGreaterThanOrEqual(1)
        expect(review.courierRating).toBeLessThanOrEqual(5)
        expect(Number.isInteger(review.courierRating)).toBe(true)
      }
    }
  })

  it('genera fechas coherentes entre deliveredAt y now', () => {
    const orders = makeOrders(30)
    const reviews = buildDemoReviews({
      orders,
      reviewRate: 0.8,
      random: createSeededRandom(7),
      now: NOW,
    })
    const orderById = new Map(orders.map((order) => [order.id, order]))

    for (const review of reviews) {
      const order = orderById.get(review.orderId)!
      expect(review.createdAt.getTime()).toBeGreaterThanOrEqual(order.deliveredAt.getTime())
      expect(review.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime())
      expect(review.updatedAt.getTime()).toBe(review.createdAt.getTime())
    }
  })

  it('es determinista con la misma semilla', () => {
    const orders = makeOrders(25)
    const first = buildDemoReviews({
      orders,
      reviewRate: 0.7,
      random: createSeededRandom(555),
      now: NOW,
    })
    const second = buildDemoReviews({
      orders,
      reviewRate: 0.7,
      random: createSeededRandom(555),
      now: NOW,
    })

    expect(first).toEqual(second)
  })
})
