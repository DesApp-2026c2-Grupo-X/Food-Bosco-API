import type { PublicCategory } from '../category/category.model'
import { PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import type { PublicProduct } from '../product/product.model'
import type { PublicPromotion } from './promotion.model'
import { resolveProductPromotionPreviews, resolvePromotionCatalog } from './promotion.preview'

const NOW = new Date('2026-11-19T15:00:00.000Z') // Jueves 12:00 en Argentina

const makePromotion = (overrides: Partial<PublicPromotion> = {}): PublicPromotion => ({
  id: 'promo-1',
  name: 'Promo test',
  description: null,
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T23:59:59.999Z',
  active: true,
  type: PROMOTION_TYPE.percentage,
  discountValue: 20,
  maxDiscount: null,
  buyQuantity: null,
  payQuantity: null,
  scope: PROMOTION_SCOPE.product,
  categoryIds: [],
  productIds: ['p1'],
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

const makeProduct = (overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 'p1',
  categoryId: 'c1',
  name: 'Hamburguesa',
  description: 'Clásica',
  price: 1000,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
  ...overrides,
})

const makeCategory = (overrides: Partial<PublicCategory> = {}): PublicCategory => ({
  id: 'c1',
  name: 'Hamburguesas',
  active: true,
  ...overrides,
})

const previewOf = (promotion: PublicPromotion, product = makeProduct()) =>
  resolveProductPromotionPreviews([product], [promotion], 'branch-1', NOW).get(product.id)

describe('resolveProductPromotionPreviews', () => {
  it.each([
    {
      name: 'porcentaje sin tope',
      promotion: makePromotion({ discountValue: 20 }),
      expectedPrice: 800,
      expectedBadge: '-20%',
      expectedMaxDiscount: null,
    },
    {
      name: 'porcentaje con tope',
      promotion: makePromotion({ discountValue: 20, maxDiscount: 100 }),
      expectedPrice: null,
      expectedBadge: '-20%',
      expectedMaxDiscount: 100,
    },
    {
      name: 'monto fijo',
      promotion: makePromotion({
        type: PROMOTION_TYPE.fixedAmount,
        discountValue: 1000,
      }),
      expectedPrice: null,
      expectedBadge: 'Hasta $1.000 OFF',
      expectedMaxDiscount: null,
    },
    {
      name: '2x1',
      promotion: makePromotion({
        type: PROMOTION_TYPE.buyXGetY,
        discountValue: null,
        buyQuantity: 2,
        payQuantity: 1,
      }),
      expectedPrice: null,
      expectedBadge: '2x1',
      expectedMaxDiscount: null,
    },
  ])(
    '$name calcula badge y precio estimado',
    ({ promotion, expectedPrice, expectedBadge, expectedMaxDiscount }) => {
      const result = previewOf(promotion)

      expect(result?.promotion).not.toBeNull()
      expect(result?.promotion?.badge).toBe(expectedBadge)
      expect(result?.promotion?.estimatedUnitPrice).toBe(expectedPrice)
      expect(result?.promotion?.maxDiscount).toBe(expectedMaxDiscount)
      expect(result?.promotionCount).toBe(1)
    },
  )

  it.each([
    {
      name: 'vencida',
      promotion: makePromotion({ endDate: '2026-11-18T23:59:59.999Z' }),
    },
    {
      name: 'inactiva',
      promotion: makePromotion({ active: false }),
    },
    {
      name: 'día incorrecto',
      promotion: makePromotion({ daysOfWeek: [1] }),
    },
    {
      name: 'fuera de horario',
      promotion: makePromotion({ startTime: '20:00', endTime: '23:00' }),
    },
    {
      name: 'otra sucursal',
      promotion: makePromotion({ branchIds: ['branch-2'] }),
    },
    {
      name: 'scope ORDER',
      promotion: makePromotion({ scope: PROMOTION_SCOPE.order, productIds: [] }),
    },
    {
      name: 'cupón',
      promotion: makePromotion({ code: 'PROMO20' }),
    },
  ])('$name no genera preview', ({ promotion }) => {
    const result = previewOf(promotion)

    expect(result?.promotion).toBeNull()
    expect(result?.promotions).toEqual([])
    expect(result?.promotionCount).toBe(0)
  })

  it('producto no disponible no genera preview', () => {
    const result = previewOf(makePromotion(), makeProduct({ available: false }))

    expect(result?.promotion).toBeNull()
  })

  it('mínimo de subtotal no cumplido deja conditionsMet=false y sin precio', () => {
    const result = previewOf(makePromotion({ minSubtotal: 2000 }))

    expect(result?.promotion?.conditionsMet).toBe(false)
    expect(result?.promotion?.estimatedUnitPrice).toBeNull()
  })

  it('mínimo de cantidad no cumplido deja conditionsMet=false y sin precio', () => {
    const result = previewOf(makePromotion({ minQuantity: 2 }))

    expect(result?.promotion?.conditionsMet).toBe(false)
    expect(result?.promotion?.estimatedUnitPrice).toBeNull()
  })

  it('elige el mayor beneficio y cuenta todas las promociones elegibles', () => {
    const second = makePromotion({
      id: 'promo-2',
      name: 'Promo fija',
      type: PROMOTION_TYPE.fixedAmount,
      discountValue: 100,
      priority: 100,
    })

    const result = resolveProductPromotionPreviews(
      [makeProduct()],
      [makePromotion(), second],
      'branch-1',
      NOW,
    ).get('p1')

    expect(result?.promotion?.promotionId).toBe('promo-1')
    expect(result?.promotionCount).toBe(2)
    expect(result?.promotions).toHaveLength(2)
  })

  it('prefiere una promo aplicable antes que una con mínimos no cumplidos', () => {
    const bestButConditional = makePromotion({
      id: 'promo-cond',
      discountValue: 50,
      minSubtotal: 5000,
    })
    const applicable = makePromotion({
      id: 'promo-applicable',
      discountValue: 10,
    })

    const result = resolveProductPromotionPreviews(
      [makeProduct()],
      [bestButConditional, applicable],
      'branch-1',
      NOW,
    ).get('p1')

    expect(result?.promotion?.promotionId).toBe('promo-applicable')
    expect(result?.promotion?.conditionsMet).toBe(true)
  })

  it('desempata por prioridad cuando el score es igual', () => {
    const lowPriority = makePromotion({ id: 'promo-low', priority: 1 })
    const highPriority = makePromotion({ id: 'promo-high', priority: 10 })

    const result = resolveProductPromotionPreviews(
      [makeProduct()],
      [lowPriority, highPriority],
      'branch-1',
      NOW,
    ).get('p1')

    expect(result?.promotion?.promotionId).toBe('promo-high')
  })

  it('redondea el descuento a pesos enteros como el motor', () => {
    const result = previewOf(makePromotion({ discountValue: 15 }), makeProduct({ price: 999 }))

    expect(result?.promotion?.estimatedUnitPrice).toBe(849)
  })

  it('aplica promociones por categoría', () => {
    const result = previewOf(
      makePromotion({
        scope: PROMOTION_SCOPE.category,
        productIds: [],
        categoryIds: ['c1'],
      }),
    )

    expect(result?.promotion).not.toBeNull()
  })

  it('con branchId null sólo aplica promociones globales', () => {
    const global = makePromotion({ id: 'promo-global' })
    const branchOnly = makePromotion({ id: 'promo-branch', branchIds: ['branch-1'] })

    const result = resolveProductPromotionPreviews(
      [makeProduct()],
      [global, branchOnly],
      null,
      NOW,
    ).get('p1')

    expect(result?.promotions.map((promotion) => promotion.promotionId)).toEqual(['promo-global'])
  })
})

describe('resolvePromotionCatalog', () => {
  it('hidrata productos de una promo PRODUCT', () => {
    const promotion = makePromotion()
    const product = makeProduct()
    const previews = resolveProductPromotionPreviews([product], [promotion], 'branch-1', NOW)

    const [item] = resolvePromotionCatalog([promotion], [product], [], previews)

    expect(item.kind).toBe('PERCENTAGE')
    expect(item.badge).toBe('-20%')
    expect(item.categoryIds).toEqual([])
    expect(item.productIds).toEqual(['p1'])
    expect(item.products).toHaveLength(1)
    expect(item.products[0].promotion?.badge).toBe('-20%')
  })

  it('hidrata categorías de una promo CATEGORY y no expande productos', () => {
    const promotion = makePromotion({
      scope: PROMOTION_SCOPE.category,
      productIds: [],
      categoryIds: ['c1'],
    })
    const category = makeCategory()
    const previews = resolveProductPromotionPreviews([], [promotion], 'branch-1', NOW)

    const [item] = resolvePromotionCatalog([promotion], [], [category], previews)

    expect(item.categories).toEqual([category])
    expect(item.products).toEqual([])
  })

  it('muestra cupón e informativa con sus badges', () => {
    const coupon = makePromotion({ id: 'promo-coupon', code: 'PROMO20' })
    const informational = makePromotion({ id: 'promo-info', type: null, scope: null })
    const previews = new Map()

    const result = resolvePromotionCatalog([coupon, informational], [], [], previews)

    expect(result[0].kind).toBe('COUPON')
    expect(result[0].badge).toBe('Cupón')
    expect(result[1].kind).toBe('INFORMATIONAL')
    expect(result[1].badge).toBe('Beneficio')
  })
})
