import type { BranchService } from '../branch/branch.service'
import { ERROR_CODES, ORDER_STATUS } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import type { PublicOrder } from '../order/order.model'
import type { OrderService } from '../order/order.service'
import type { PublicOrderReview } from './order-review.model'
import { OrderReviewOrchestrator } from './order-review.orchestrator'
import type { OrderReviewService } from './order-review.service'

const order = (overrides: Partial<PublicOrder> = {}): PublicOrder => ({
  id: 'o1',
  number: '000001',
  clientId: 'c1',
  branchId: 'b1',
  addressId: 'a1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: ORDER_STATUS.delivered,
  subtotal: 100,
  discountTotal: 0,
  total: 100,
  promotionCode: null,
  appliedPromotions: [],
  estimatedDeliveryAt: null,
  riderId: 'u-rider',
  tripId: 't1',
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: [],
  ...overrides,
})

const review = (overrides: Partial<PublicOrderReview> = {}): PublicOrderReview => ({
  id: 'r1',
  orderId: 'o1',
  customerId: 'c1',
  branchId: 'b1',
  branchRating: 5,
  branchComment: null,
  courierId: 'u-rider',
  courierRating: 4,
  courierComment: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const makeOrchestrator = (
  deps: {
    orderService?: Partial<OrderService>
    reviewService?: Partial<OrderReviewService>
    branchService?: Partial<BranchService>
  } = {},
) => {
  const orderService = {
    findById: jest.fn().mockResolvedValue(order()),
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, limit: 100, offset: 0 } }),
    ...deps.orderService,
  }
  const reviewService = {
    findByOrderId: jest.fn().mockResolvedValue(null),
    listByCustomer: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(review()),
    branchStats: jest.fn(),
    courierStats: jest.fn(),
    branchRanking: jest.fn(),
    courierRanking: jest.fn(),
    summary: jest.fn(),
    ...deps.reviewService,
  }
  const branchService = {
    findById: jest.fn().mockResolvedValue({ id: 'b1' }),
    ...deps.branchService,
  }

  const orchestrator = new OrderReviewOrchestrator(
    orderService as unknown as OrderService,
    reviewService as unknown as OrderReviewService,
    branchService as unknown as BranchService,
  )

  return { orchestrator, orderService, reviewService, branchService }
}

const catchCode = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise
    return undefined
  } catch (error) {
    return error instanceof DomainException ? error.code : 'UNKNOWN'
  }
}

interface ReviewInput {
  branchRating: number
  courierRating?: number
}

const dto: ReviewInput = { branchRating: 5, courierRating: 4 }

describe('OrderReviewOrchestrator.create', () => {
  const cases: Array<{
    name: string
    order?: Partial<PublicOrder>
    dto: ReviewInput
    existing?: PublicOrderReview | null
    branchMissing?: boolean
    code?: string
  }> = [
    { name: 'reseña completa válida', dto },
    {
      name: 'pedido inexistente',
      order: {},
      dto,
      code: ERROR_CODES.orderNotFound,
    },
    {
      name: 'pedido de otro cliente',
      order: { clientId: 'c2' },
      dto,
      code: ERROR_CODES.orderNotOwned,
    },
    {
      name: 'pedido todavía no entregado',
      order: { status: ORDER_STATUS.onTheWay },
      dto,
      code: ERROR_CODES.orderNotDelivered,
    },
    {
      name: 'sucursal inexistente',
      dto,
      branchMissing: true,
      code: ERROR_CODES.invalidReviewBranch,
    },
    {
      name: 'pedido ya calificado',
      dto,
      existing: review(),
      code: ERROR_CODES.reviewAlreadyExists,
    },
    {
      name: 'pedido sin repartidor con datos de repartidor',
      order: { riderId: null, tripId: null },
      dto,
      code: ERROR_CODES.courierNotAssigned,
    },
    {
      name: 'pedido con repartidor sin puntaje de repartidor',
      dto: { branchRating: 5 },
      code: ERROR_CODES.courierRatingRequired,
    },
    {
      name: 'pedido sin repartidor sólo con sucursal',
      order: { riderId: null, tripId: null },
      dto: { branchRating: 5 },
    },
  ]

  it.each(cases)(
    '$name → $code',
    async ({ order: orderPatch, dto: payload, existing, branchMissing, code }) => {
      const { orchestrator, orderService, reviewService, branchService } = makeOrchestrator({
        orderService: { findById: jest.fn().mockResolvedValue(order(orderPatch)) },
        reviewService: { findByOrderId: jest.fn().mockResolvedValue(existing ?? null) },
        branchService: {
          findById: jest.fn().mockResolvedValue(branchMissing ? null : { id: 'b1' }),
        },
      })

      if (orderPatch && Object.keys(orderPatch).length === 0) {
        ;(orderService.findById as jest.Mock).mockResolvedValue(null)
      }

      const result = await catchCode(orchestrator.create('c1', 'o1', payload))
      expect(result).toBe(code)
      expect(reviewService.create).toHaveBeenCalledTimes(code ? 0 : 1)
      expect(branchService.findById).toHaveBeenCalledTimes(
        code === ERROR_CODES.orderNotFound ||
          code === ERROR_CODES.orderNotOwned ||
          code === ERROR_CODES.orderNotDelivered
          ? 0
          : 1,
      )
    },
  )

  it('toma sucursal y repartidor del pedido, no del cliente', async () => {
    const { orchestrator, reviewService } = makeOrchestrator({
      orderService: {
        findById: jest.fn().mockResolvedValue(order({ riderId: 'u-real', branchId: 'b-real' })),
      },
      branchService: { findById: jest.fn().mockResolvedValue({ id: 'b-real' }) },
    })

    await orchestrator.create('c1', 'o1', {
      branchRating: 5,
      branchComment: '  rico  ',
      courierRating: 4,
      courierComment: 'ok',
    })

    expect(reviewService.create).toHaveBeenCalledWith({
      orderId: 'o1',
      customerId: 'c1',
      branchId: 'b-real',
      branchRating: 5,
      branchComment: '  rico  ',
      courierId: 'u-real',
      courierRating: 4,
      courierComment: 'ok',
    })
  })

  it('ignora comentarios de repartidor cuando el pedido no tiene delivery', async () => {
    const { orchestrator, reviewService } = makeOrchestrator({
      orderService: { findById: jest.fn().mockResolvedValue(order({ riderId: null })) },
    })

    await orchestrator.create('c1', 'o1', { branchRating: 5, courierComment: '   ' })

    expect(reviewService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        courierId: null,
        courierRating: null,
        courierComment: null,
      }),
    )
  })
})

describe('OrderReviewOrchestrator.getStatus', () => {
  const cases: Array<{
    name: string
    order?: Partial<PublicOrder>
    existing?: PublicOrderReview | null
    canReview: boolean
  }> = [
    { name: 'entregado sin reseña', canReview: true },
    { name: 'entregado con reseña', existing: review(), canReview: false },
    { name: 'en camino sin reseña', order: { status: ORDER_STATUS.onTheWay }, canReview: false },
    { name: 'cancelado sin reseña', order: { status: ORDER_STATUS.cancelled }, canReview: false },
  ]

  it.each(cases)(
    '$name → canReview $canReview',
    async ({ order: orderPatch, existing, canReview }) => {
      const { orchestrator } = makeOrchestrator({
        orderService: { findById: jest.fn().mockResolvedValue(order(orderPatch)) },
        reviewService: { findByOrderId: jest.fn().mockResolvedValue(existing ?? null) },
      })

      const result = await orchestrator.getStatus('c1', 'o1')

      expect(result.canReview).toBe(canReview)
      expect(result.review).toBe(existing ?? null)
    },
  )

  it('rechaza pedidos de otro cliente', async () => {
    const { orchestrator } = makeOrchestrator({
      orderService: { findById: jest.fn().mockResolvedValue(order({ clientId: 'c2' })) },
    })

    await expect(orchestrator.getStatus('c1', 'o1')).rejects.toMatchObject({
      code: ERROR_CODES.orderNotOwned,
    })
  })
})

describe('OrderReviewOrchestrator.listPending', () => {
  it('excluye los pedidos que ya tienen reseña', async () => {
    const { orchestrator, orderService, reviewService } = makeOrchestrator({
      orderService: {
        list: jest.fn().mockResolvedValue({
          data: [order({ id: 'o1' }), order({ id: 'o2' }), order({ id: 'o3' })],
          meta: { total: 3, limit: 100, offset: 0 },
        }),
      },
      reviewService: {
        listByCustomer: jest.fn().mockResolvedValue([review({ orderId: 'o2' })]),
      },
    })

    const result = await orchestrator.listPending('c1')

    expect(result.map((entry) => entry.id)).toEqual(['o1', 'o3'])
    expect(orderService.list).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c1', status: ORDER_STATUS.delivered }),
    )
    expect(reviewService.listByCustomer).toHaveBeenCalledWith('c1')
  })
})

describe('OrderReviewOrchestrator estadísticas', () => {
  it('delega las consultas de estadísticas', async () => {
    const { orchestrator } = makeOrchestrator({
      reviewService: {
        branchStats: jest.fn().mockResolvedValue('branch'),
        courierStats: jest.fn().mockResolvedValue('courier'),
        branchRanking: jest.fn().mockResolvedValue('branch-ranking'),
        courierRanking: jest.fn().mockResolvedValue('courier-ranking'),
        summary: jest.fn().mockResolvedValue('summary'),
      },
    })

    await expect(orchestrator.branchStats('b1', { from: '2026-01-01' })).resolves.toBe('branch')
    await expect(orchestrator.courierStats('u1')).resolves.toBe('courier')
    await expect(orchestrator.branchRanking({ limit: 5 }, 5)).resolves.toBe('branch-ranking')
    await expect(orchestrator.courierRanking({}, 3)).resolves.toBe('courier-ranking')
    await expect(orchestrator.summary()).resolves.toBe('summary')
  })
})
