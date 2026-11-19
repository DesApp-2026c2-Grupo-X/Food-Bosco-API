import type { PublicCategory } from '../category/category.model'
import type { PublicOrder } from '../order/order.model'
import type { PublicProduct } from '../product/product.model'
import type { PublicPromotion } from '../promotion/promotion.model'
import {
  buildTasteProfile,
  rankDiscovery,
  rankForYou,
  rankPromotions,
  selectReorderOrders,
  sortCategories,
} from './ranking'

const NOW = new Date('2026-11-18T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS)

const isoDaysAgo = (days: number): string => daysAgo(days).toISOString()

const product = (overrides: Partial<PublicProduct> & { id: string }): PublicProduct => ({
  categoryId: 'cat-a',
  name: overrides.id,
  description: '',
  price: 100,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const order = (
  overrides: Partial<PublicOrder> & { id: string; items: PublicOrder['items'] },
): PublicOrder => {
  const createdAt = overrides.createdAt ?? isoDaysAgo(1)
  return {
    number: overrides.id,
    clientId: 'client-1',
    branchId: 'branch-1',
    addressId: 'address-1',
    deliveryAddress: { text: 'Calle 1', latitude: 0, longitude: 0 },
    status: 'delivered',
    subtotal: 0,
    discountTotal: 0,
    total: 100,
    promotionCode: null,
    appliedPromotions: [],
    estimatedDeliveryAt: null,
    riderId: null,
    tripId: null,
    createdAt,
    statusHistory: [
      {
        previousStatus: 'on_the_way',
        newStatus: 'delivered',
        changedAt: createdAt,
      },
    ],
    availableTransitions: [],
    ...overrides,
  }
}

const item = (productId: string, quantity = 1): PublicOrder['items'][number] => ({
  productId,
  name: productId,
  unitPrice: 100,
  quantity,
  observations: null,
  subtotal: 100 * quantity,
  options: [],
})

const promotion = (overrides: Partial<PublicPromotion> & { id: string }): PublicPromotion => ({
  name: overrides.id,
  description: null,
  startDate: isoDaysAgo(10),
  endDate: isoDaysAgo(-10),
  active: true,
  type: null,
  discountValue: null,
  maxDiscount: null,
  buyQuantity: null,
  payQuantity: null,
  scope: null,
  categoryIds: [],
  productIds: [],
  branchIds: [],
  minSubtotal: 0,
  minQuantity: 0,
  daysOfWeek: [],
  startTime: null,
  endTime: null,
  code: null,
  stackable: false,
  priority: 0,
  maxUsesTotal: null,
  maxUsesPerCustomer: null,
  usedCount: 0,
  ...overrides,
})

describe('ranking — perfil de gustos', () => {
  const products = [product({ id: 'burger', categoryId: 'cat-burgers' })]

  it('ignora pedidos no entregados y fuera de la ventana', () => {
    const orders = [
      order({ id: 'ok', items: [item('burger')], createdAt: isoDaysAgo(10) }),
      order({ id: 'cancelled', items: [item('burger')], status: 'cancelled' }),
      order({ id: 'old', items: [item('burger')], createdAt: isoDaysAgo(400) }),
    ]

    const profile = buildTasteProfile(orders, products, NOW)

    expect(profile.hasHistory).toBe(true)
    expect(profile.windowOrders.map((entry) => entry.id)).toEqual(['ok'])
    expect(profile.purchasedProductIds).toEqual(new Set(['burger']))
  })

  it('sin entregados en la ventana no hay historial', () => {
    const profile = buildTasteProfile(
      [order({ id: 'old', items: [item('burger')], createdAt: isoDaysAgo(400) })],
      products,
      NOW,
    )

    expect(profile.hasHistory).toBe(false)
    expect(profile.productScore.size).toBe(0)
    expect(profile.topCategoryIds).toEqual([])
  })

  it.each([
    { recentDays: 0, olderDays: 45 },
    { recentDays: 10, olderDays: 100 },
  ])(
    'un pedido de $recentDays días pesa más que uno de $olderDays días',
    ({ recentDays, olderDays }) => {
      const recentProfile = buildTasteProfile(
        [order({ id: 'recent', items: [item('burger')], createdAt: isoDaysAgo(recentDays) })],
        products,
        NOW,
      )
      const olderProfile = buildTasteProfile(
        [order({ id: 'older', items: [item('burger')], createdAt: isoDaysAgo(olderDays) })],
        products,
        NOW,
      )

      expect(recentProfile.productScore.get('burger')).toBeGreaterThan(
        olderProfile.productScore.get('burger') ?? 0,
      )
    },
  )

  it('usa la categoría actual del catálogo y omite productos borrados', () => {
    const profile = buildTasteProfile(
      [
        order({
          id: 'o1',
          createdAt: isoDaysAgo(0),
          items: [item('burger'), item('deleted')],
        }),
      ],
      products,
      NOW,
    )

    expect(profile.categoryScore.get('cat-burgers')).toBe(1)
    expect(profile.categoryScore.size).toBe(1)
    expect(profile.purchasedProductIds.has('deleted')).toBe(true)
  })

  it('elige sucursal favorita y top 3 de categorías de forma determinística', () => {
    const profile = buildTasteProfile(
      [
        order({ id: 'a', branchId: 'branch-2', items: [item('burger')] }),
        order({ id: 'b', branchId: 'branch-2', items: [item('burger')] }),
        order({ id: 'c', branchId: 'branch-1', items: [item('burger')] }),
      ],
      products,
      NOW,
    )

    expect(profile.favoriteBranchId).toBe('branch-2')
    expect(profile.topCategoryIds).toEqual(['cat-burgers'])
  })
})

describe('ranking — para vos', () => {
  const products = [
    product({ id: 'burger-a', name: 'A', categoryId: 'cat-burgers' }),
    product({ id: 'burger-b', name: 'B', categoryId: 'cat-burgers' }),
    product({ id: 'burger-c', name: 'C', categoryId: 'cat-burgers' }),
    product({ id: 'drink', name: 'D', categoryId: 'cat-drinks' }),
    product({ id: 'paused', name: 'E', categoryId: 'cat-burgers', available: false }),
  ]

  const profile = buildTasteProfile(
    [
      order({
        id: 'o1',
        items: [item('burger-a', 3), item('burger-b', 2), item('burger-c', 1)],
      }),
    ],
    products,
    NOW,
  )

  it('excluye productos no disponibles', () => {
    const recommendations = rankForYou(profile, products, 10)

    expect(recommendations.map((entry) => entry.product.id)).not.toContain('paused')
  })

  it('limita a 2 por categoría cuando hay alternativas de otras categorías', () => {
    const diverseProducts = [
      product({ id: 'burger-a', name: 'A', categoryId: 'cat-burgers' }),
      product({ id: 'burger-b', name: 'B', categoryId: 'cat-burgers' }),
      product({ id: 'burger-c', name: 'C', categoryId: 'cat-burgers' }),
      product({ id: 'drink-a', name: 'D', categoryId: 'cat-drinks' }),
      product({ id: 'drink-b', name: 'E', categoryId: 'cat-drinks' }),
      product({ id: 'drink-c', name: 'F', categoryId: 'cat-drinks' }),
    ]
    const diverseProfile = buildTasteProfile(
      [
        order({
          id: 'o1',
          items: [
            item('burger-a', 3),
            item('burger-b', 3),
            item('burger-c', 3),
            item('drink-a', 1),
            item('drink-b', 1),
            item('drink-c', 1),
          ],
        }),
      ],
      diverseProducts,
      NOW,
    )

    const recommendations = rankForYou(diverseProfile, diverseProducts, 4)

    expect(recommendations).toHaveLength(4)
    expect(
      recommendations.filter((entry) => entry.product.categoryId === 'cat-burgers'),
    ).toHaveLength(2)
    expect(
      recommendations.filter((entry) => entry.product.categoryId === 'cat-drinks'),
    ).toHaveLength(2)
  })

  it('completa slots con el excedente cuando no hay otras categorías', () => {
    const recommendations = rankForYou(profile, products, 4)
    const ids = recommendations.map((entry) => entry.product.id)

    expect(ids).toEqual(['burger-a', 'burger-b', 'burger-c', 'drink'])
  })

  it('marca REPEAT para productos comprados y puntúa de forma acotada', () => {
    const recommendations = rankForYou(profile, products, 4)
    const burger = recommendations.find((entry) => entry.product.id === 'burger-a')

    expect(burger?.reason).toBe('REPEAT')
    expect(burger?.hint).toBe('Ya lo pediste')
    expect(burger?.score).toBeGreaterThan(0)
    expect(burger?.score).toBeLessThanOrEqual(7.5)
  })

  it('sin historial no recomienda productos', () => {
    const empty = buildTasteProfile([], products, NOW)

    expect(rankForYou(empty, products, 8)).toEqual([])
  })

  it('es determinístico para los mismos datos', () => {
    const first = rankForYou(profile, products, 4)
    const second = rankForYou(profile, products, 4)

    expect(first).toEqual(second)
  })
})

describe('ranking — descubrimiento', () => {
  const products = [
    product({ id: 'burger', categoryId: 'cat-burgers' }),
    product({ id: 'fries', categoryId: 'cat-burgers' }),
    product({ id: 'salad', categoryId: 'cat-salads' }),
    product({ id: 'pasta', categoryId: 'cat-pasta' }),
  ]
  const profile = buildTasteProfile([order({ id: 'o1', items: [item('burger')] })], products, NOW)

  it('devuelve categorías sin historial y excluye comprados', () => {
    const recommendations = rankDiscovery(profile, products, new Set(), 2)
    const ids = recommendations.map((entry) => entry.product.id)

    expect(ids.sort()).toEqual(['pasta', 'salad'])
    expect(recommendations.every((entry) => entry.reason === 'DISCOVERY')).toBe(true)
  })

  it('completa con productos no comprados de categorías conocidas', () => {
    const recommendations = rankDiscovery(profile, products, new Set(), 4)
    const fallback = recommendations.find((entry) => entry.product.id === 'fries')

    expect(fallback?.reason).toBe('FAVORITE_CATEGORY')
  })

  it('excluye productos ya mostrados', () => {
    const recommendations = rankDiscovery(profile, products, new Set(['salad']), 4)

    expect(recommendations.map((entry) => entry.product.id)).not.toContain('salad')
  })

  it('sin historial devuelve vacío', () => {
    const empty = buildTasteProfile([], products, NOW)

    expect(rankDiscovery(empty, products, new Set(), 4)).toEqual([])
  })
})

describe('ranking — volvé a pedir', () => {
  const orders = [
    order({
      id: 'newer',
      createdAt: isoDaysAgo(1),
      items: [item('burger'), item('drink')],
    }),
    order({
      id: 'same-signature',
      createdAt: isoDaysAgo(2),
      items: [item('drink'), item('burger')],
    }),
    order({
      id: 'different',
      createdAt: isoDaysAgo(3),
      items: [item('salad')],
    }),
    order({
      id: 'empty',
      createdAt: isoDaysAgo(4),
      items: [],
    }),
  ]

  it('deduplica por sucursal + productos y conserva el más reciente', () => {
    const selected = selectReorderOrders(orders, 3)

    expect(selected.map((entry) => entry.id)).toEqual(['newer', 'different'])
  })

  it('respeta el límite', () => {
    expect(selectReorderOrders(orders, 1).map((entry) => entry.id)).toEqual(['newer'])
    expect(selectReorderOrders(orders, 0)).toEqual([])
  })
})

describe('ranking — categorías y promociones', () => {
  const categories: PublicCategory[] = [
    { id: 'cat-a', name: 'A', active: true },
    { id: 'cat-b', name: 'B', active: true },
    { id: 'cat-c', name: 'C', active: true },
  ]

  const profile = buildTasteProfile(
    [
      order({
        id: 'o1',
        items: [item('product-b', 2), item('product-c', 1)],
      }),
    ],
    [
      product({ id: 'product-b', categoryId: 'cat-b' }),
      product({ id: 'product-c', categoryId: 'cat-c' }),
    ],
    NOW,
  )

  it('ordena categorías por afinidad y luego por nombre', () => {
    expect(sortCategories(categories, profile).map((category) => category.id)).toEqual([
      'cat-b',
      'cat-c',
      'cat-a',
    ])
  })

  it('ordena promociones por afinidad y prioridad', () => {
    const promotions = [
      promotion({ id: 'product-match', productIds: ['product-b'], priority: 0 }),
      promotion({ id: 'priority-only', priority: 10 }),
      promotion({ id: 'category-match', categoryIds: ['cat-c'], priority: 0 }),
      promotion({
        id: 'branch-match',
        branchIds: ['branch-1'],
        priority: 0,
      }),
    ]

    const ranked = rankPromotions(promotions, profile, 10)

    expect(ranked.map((entry) => entry.id)).toEqual([
      'product-match',
      'category-match',
      'branch-match',
      'priority-only',
    ])
  })

  it('respeta el tope de promociones', () => {
    const promotions = Array.from({ length: 5 }, (_, index) => promotion({ id: `promo-${index}` }))

    expect(rankPromotions(promotions, profile, 2)).toHaveLength(2)
  })
})
