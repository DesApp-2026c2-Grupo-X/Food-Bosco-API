import type { PromotionDocument, PublicPromotion } from './promotion.model'
import { serializePromotion } from './promotion.model'

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}): PromotionDocument =>
  ({
    _id: { toString: () => 'prom1' },
    name: '2x1',
    description: 'Martes',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-02-01T00:00:00.000Z'),
    active: true,
    ...overrides,
  }) as unknown as PromotionDocument

describe('serializePromotion', () => {
  it('mapea fechas a ISO 8601 y conserva nombre, descripción, estado y defaults de reglas', () => {
    const result = serializePromotion(buildDoc())

    expect(result).toEqual<PublicPromotion>({
      id: 'prom1',
      name: '2x1',
      description: 'Martes',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
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
    })
  })

  it.each([
    { name: 'description null', description: null },
    { name: 'description undefined', description: undefined },
  ])('normaliza $name a null', ({ description }) => {
    const result = serializePromotion(buildDoc({ description }))

    expect(result.description).toBeNull()
  })

  it('usa el ObjectId como string en el campo id', () => {
    const result = serializePromotion(
      buildDoc({ _id: { toString: () => '507f1f77bcf86cd799439011' } }),
    )

    expect(result.id).toBe('507f1f77bcf86cd799439011')
  })

  it('no expone campos internos del documento', () => {
    const result = serializePromotion(buildDoc({ createdAt: new Date(), secret: 'x' }))

    expect(Object.keys(result).sort()).toEqual([
      'active',
      'branchIds',
      'buyQuantity',
      'categoryIds',
      'code',
      'daysOfWeek',
      'description',
      'discountValue',
      'endDate',
      'endTime',
      'id',
      'maxDiscount',
      'maxUsesPerCustomer',
      'maxUsesTotal',
      'minQuantity',
      'minSubtotal',
      'name',
      'payQuantity',
      'priority',
      'productIds',
      'scope',
      'stackable',
      'startDate',
      'startTime',
      'type',
      'usedCount',
    ])
  })
})
