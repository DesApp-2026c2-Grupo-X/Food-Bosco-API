import type { SeededRandom, WeightedEntry } from '@repo/seed-utils'
import { ORDER_STATUS } from '../../config/constants'
import type { InsertedDemoOrder } from './demo-orders.repository'

const MINUTE_MS = 60_000

type RatingScore = 1 | 2 | 3 | 4 | 5

const BRANCH_RATING_WEIGHTS: readonly WeightedEntry<RatingScore>[] = [
  { value: 5, weight: 45 },
  { value: 4, weight: 30 },
  { value: 3, weight: 13 },
  { value: 2, weight: 7 },
  { value: 1, weight: 5 },
]

const COURIER_RATING_WEIGHTS: readonly WeightedEntry<RatingScore>[] = [
  { value: 5, weight: 50 },
  { value: 4, weight: 28 },
  { value: 3, weight: 12 },
  { value: 2, weight: 6 },
  { value: 1, weight: 4 },
]

const BRANCH_COMMENTS_BY_RATING: Record<RatingScore, readonly string[]> = {
  5: [
    'Excelente calidad, llegó todo calentito y muy bien presentado.',
    'Las hamburguesas estaban increíbles, super recomendable.',
    'Todo fresco y en su punto justo, volvemos a pedir seguro.',
    'Muy buena atención y porciones generosas, de diez.',
  ],
  4: [
    'Muy rico todo, porciones abundantes.',
    'Buena comida y bien empaquetada, solo un poquito de demora.',
    'Riquísimo como siempre, volvería a pedir.',
    'Muy conforme con el pedido, todo en orden.',
  ],
  3: [
    'La comida estaba bien pero llegó apenas tibia.',
    'Zafa, aunque esperaba un poco más por el precio.',
    'Correcto, sin sorpresas; las papas podrían estar más crocantes.',
  ],
  2: [
    'Tardó bastante más de lo estimado y las papas llegaron frías.',
    'Faltaron servilletas y aderezos que había pedido.',
    'La presentación dejó bastante que desear esta vez.',
  ],
  1: [
    'Pedido incompleto y la comida llegó fría.',
    'Muy mala experiencia, demoró muchísimo y vino todo revuelto.',
  ],
}

const COURIER_COMMENTS_BY_RATING: Record<RatingScore, readonly string[]> = {
  5: [
    'Muy amable y puntual el repartidor.',
    'Entrega impecable, tocó timbre y esperó con buena onda.',
    'Súper rápido y cuidadoso con el pedido.',
    'Excelente trato, llegó antes de lo esperado.',
  ],
  4: [
    'Llegó en tiempo y forma, todo bien.',
    'Buen servicio de entrega, sin inconvenientes.',
    'Amable y rápido, todo correcto.',
  ],
  3: [
    'Correcto en la entrega.',
    'Tardó un poco en encontrar el timbre pero todo bien.',
    'Entrega normal, sin problemas.',
  ],
  2: [
    'Costó coordinar la entrega en la puerta.',
    'Llegó bastante después del horario estimado.',
  ],
  1: [
    'Muy poca predisposición al entregar el pedido.',
    'Demoró demasiado y no avisó al llegar.',
  ],
}

export interface PlannedOrderReview {
  orderId: string
  customerId: string
  branchId: string
  branchRating: number
  branchComment: string | null
  courierId: string | null
  courierRating: number | null
  courierComment: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BuildDemoReviewsInput {
  orders: InsertedDemoOrder[]
  reviewRate?: number
  random: SeededRandom
  now: Date
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Genera reseñas determinísticas para pedidos demo entregados.
 *
 * Omite el primer pedido `delivered` (correspondiente al pedido reciente forzado)
 * para garantizar que siempre quede un pedido reciente sin calificar disponible
 * para pruebas manuales en Store.
 */
export const buildDemoReviews = (input: BuildDemoReviewsInput): PlannedOrderReview[] => {
  const { orders, random, now } = input
  const rate = clamp(input.reviewRate ?? 0.7, 0, 1)
  const deliveredOrders = orders.filter((order) => order.status === ORDER_STATUS.delivered)

  if (deliveredOrders.length <= 1 || rate <= 0) return []

  const candidates = deliveredOrders.slice(1)
  const reviews: PlannedOrderReview[] = []

  for (const order of candidates) {
    if (!random.chance(rate)) continue

    const branchRating = random.weighted(BRANCH_RATING_WEIGHTS)
    const branchComment = random.chance(0.7)
      ? random.pick(BRANCH_COMMENTS_BY_RATING[branchRating])
      : null

    let courierId: string | null = null
    let courierRating: number | null = null
    let courierComment: string | null = null

    if (order.riderId !== null) {
      courierId = order.riderId
      const score = random.weighted(COURIER_RATING_WEIGHTS)
      courierRating = score
      courierComment = random.chance(0.65) ? random.pick(COURIER_COMMENTS_BY_RATING[score]) : null
    }

    const delayMs = random.int(10, 240) * MINUTE_MS
    const timestamp = Math.max(
      order.deliveredAt.getTime(),
      Math.min(order.deliveredAt.getTime() + delayMs, now.getTime()),
    )
    const createdAt = new Date(timestamp)

    reviews.push({
      orderId: order.id,
      customerId: order.clientId,
      branchId: order.branchId,
      branchRating,
      branchComment,
      courierId,
      courierRating,
      courierComment,
      createdAt,
      updatedAt: createdAt,
    })
  }

  return reviews
}
