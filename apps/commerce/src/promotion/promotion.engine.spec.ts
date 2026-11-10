import { PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import {
  evaluatePromotions,
  PromotableLine,
  PromotionCandidate,
  PromotionEvaluationContext,
} from './promotion.engine'

const makeCandidate = (overrides: Partial<PromotionCandidate> = {}): PromotionCandidate => ({
  id: 'promo-1',
  name: 'Promo Test',
  description: null,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-12-31T23:59:59.999Z',
  active: true,
  type: PROMOTION_TYPE.percentage,
  discountValue: 10,
  maxDiscount: null,
  buyQuantity: null,
  payQuantity: null,
  scope: PROMOTION_SCOPE.order,
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

const makeContext = (
  lines: PromotableLine[],
  overrides: Partial<PromotionEvaluationContext> = {},
): PromotionEvaluationContext => {
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0)
  const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0)
  return {
    lines,
    subtotal,
    totalQuantity,
    branchId: 'branch-1',
    clientId: 'client-1',
    now: new Date('2026-06-15T12:00:00.000Z'), // Lunes mediodía
    requestedCode: null,
    usage: new Map(),
    ...overrides,
  }
}

describe('PromotionEngine (pure functions)', () => {
  const line = (
    id: string,
    productId: string,
    categoryId: string,
    unitPrice: number,
    quantity: number,
  ): PromotableLine => ({
    lineId: id,
    productId,
    categoryId,
    unitPrice,
    quantity,
    subtotal: unitPrice * quantity,
  })

  it('1. Porcentaje simple: 10% de 19.000 = 1.900', () => {
    const lines = [line('l1', 'p1', 'c1', 19000, 1)]
    const promo = makeCandidate({ discountValue: 10 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(1900)
    expect(res.total).toBe(17100)
    expect(res.appliedPromotions).toHaveLength(1)
    expect(res.appliedPromotions[0].amount).toBe(1900)
  })

  it('2. Porcentaje con tope: 30% de 20.000, tope 3.000 = 3.000', () => {
    const lines = [line('l1', 'p1', 'c1', 20000, 1)]
    const promo = makeCandidate({ discountValue: 30, maxDiscount: 3000 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(3000)
    expect(res.total).toBe(17000)
  })

  it('3. Monto fijo: 2.000 sobre 12.000 = 2.000', () => {
    const lines = [line('l1', 'p1', 'c1', 12000, 1)]
    const promo = makeCandidate({ type: PROMOTION_TYPE.fixedAmount, discountValue: 2000 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(2000)
    expect(res.total).toBe(10000)
  })

  it('4. Monto fijo mayor al subtotal: se capea al subtotal', () => {
    const lines = [line('l1', 'p1', 'c1', 1500, 1)]
    const promo = makeCandidate({ type: PROMOTION_TYPE.fixedAmount, discountValue: 5000 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(1500)
    expect(res.total).toBe(0)
  })

  it('5. Mínimo de compra no cumplido: no descuenta', () => {
    const lines = [line('l1', 'p1', 'c1', 8000, 1)]
    const promo = makeCandidate({ minSubtotal: 10000 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(0)
    expect(res.appliedPromotions).toHaveLength(0)
  })

  it('6. Mínimo de unidades no cumplido: no descuenta', () => {
    const lines = [line('l1', 'p1', 'c1', 5000, 2)]
    const promo = makeCandidate({ minQuantity: 3 })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(0)
  })

  it('7. Scope CATEGORY: solo suma líneas de esa categoría', () => {
    const lines = [
      line('l1', 'p1', 'cat-hamburguesas', 6000, 2), // 12.000
      line('l2', 'p2', 'cat-bebidas', 2000, 2), // 4.000
    ]
    const promo = makeCandidate({
      scope: PROMOTION_SCOPE.category,
      categoryIds: ['cat-hamburguesas'],
      discountValue: 50,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    // 50% de 12.000 = 6.000
    expect(res.discountTotal).toBe(6000)
    expect(res.total).toBe(10000)
  })

  it('8. Scope PRODUCT: solo suma líneas de ese producto', () => {
    const lines = [
      line('l1', 'prod-burger', 'cat1', 8000, 1),
      line('l2', 'prod-pizza', 'cat1', 10000, 1),
    ]
    const promo = makeCandidate({
      scope: PROMOTION_SCOPE.product,
      productIds: ['prod-burger'],
      discountValue: 20,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    // 20% de 8.000 = 1.600
    expect(res.discountTotal).toBe(1600)
    expect(res.total).toBe(16400)
  })

  it('9. NxM 2x1 con 3 unidades iguales: descuenta 1 unidad', () => {
    const lines = [line('l1', 'p1', 'c1', 8000, 3)]
    const promo = makeCandidate({
      type: PROMOTION_TYPE.buyXGetY,
      buyQuantity: 2,
      payQuantity: 1,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    // 3 unidades -> 1 grupo de 2 -> 1 gratis = 8.000
    expect(res.discountTotal).toBe(8000)
    expect(res.total).toBe(16000)
  })

  it('10. NxM 2x1 con líneas de distinto precio: se regala la más barata', () => {
    const lines = [
      line('l1', 'p1', 'c1', 8500, 2), // dos de 8.500
      line('l2', 'p2', 'c1', 8000, 1), // una de 8.000
    ]
    const promo = makeCandidate({
      type: PROMOTION_TYPE.buyXGetY,
      buyQuantity: 2,
      payQuantity: 1,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    // 3 unidades en total: [8000, 8500, 8500]. 1 grupo de 2 -> 1 gratis = la de 8.000
    expect(res.discountTotal).toBe(8000)
  })

  it('11. NxM 3x2 con 7 unidades: 2 grupos -> 2 unidades gratis (las más baratas)', () => {
    const lines = [line('l1', 'p1', 'c1', 1000, 3), line('l2', 'p2', 'c1', 2000, 4)]
    // Unidades: 1000, 1000, 1000, 2000, 2000, 2000, 2000
    // floor(7/3) = 2 grupos. 2 * (3 - 2) = 2 gratis más baratas = 1000 + 1000 = 2000
    const promo = makeCandidate({
      type: PROMOTION_TYPE.buyXGetY,
      buyQuantity: 3,
      payQuantity: 2,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(2000)
  })

  it('12. NxM con cantidad menor a buyQuantity: 0 descuento', () => {
    const lines = [line('l1', 'p1', 'c1', 5000, 1)]
    const promo = makeCandidate({
      type: PROMOTION_TYPE.buyXGetY,
      buyQuantity: 2,
      payQuantity: 1,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(0)
  })

  it('13. NxM con opciones (unitPrice compuesto): se usa el unitPrice completo', () => {
    const lines = [line('l1', 'p1', 'c1', 6500 + 1500, 2)] // 8.000 cada una
    const promo = makeCandidate({
      type: PROMOTION_TYPE.buyXGetY,
      buyQuantity: 2,
      payQuantity: 1,
    })
    const res = evaluatePromotions([promo], makeContext(lines))

    expect(res.discountTotal).toBe(8000)
  })

  it('14. Día de la semana: dentro vs fuera', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    // 2026-06-15 UTC es Lunes (dayOfWeek 1)
    const promoMonday = makeCandidate({ daysOfWeek: [1], discountValue: 10 })
    const promoSaturday = makeCandidate({ daysOfWeek: [6], discountValue: 10 })

    const resMon = evaluatePromotions(
      [promoMonday],
      makeContext(lines, { now: new Date('2026-06-15T15:00:00Z') }),
    )
    expect(resMon.discountTotal).toBe(1000)

    const resSat = evaluatePromotions(
      [promoSaturday],
      makeContext(lines, { now: new Date('2026-06-15T15:00:00Z') }),
    )
    expect(resSat.discountTotal).toBe(0)
  })

  it('15. Franja horaria: dentro vs fuera', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({ startTime: '20:00', endTime: '23:30', discountValue: 10 })

    // 2026-06-15T23:30:00Z en Argentina (UTC-3) es 20:30 (dentro)
    const resInside = evaluatePromotions(
      [promo],
      makeContext(lines, { now: new Date('2026-06-15T23:30:00Z') }),
    )
    expect(resInside.discountTotal).toBe(1000)

    // 2026-06-15T15:00:00Z en Argentina es 12:00 (fuera)
    const resOutside = evaluatePromotions(
      [promo],
      makeContext(lines, { now: new Date('2026-06-15T15:00:00Z') }),
    )
    expect(resOutside.discountTotal).toBe(0)
  })

  it('16. Franja horaria que cruza medianoche (22:00 a 02:00)', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({ startTime: '22:00', endTime: '02:00', discountValue: 10 })

    // 01:00 Argentina -> 04:00 UTC
    const res1 = evaluatePromotions(
      [promo],
      makeContext(lines, { now: new Date('2026-06-16T04:00:00Z') }),
    )
    expect(res1.discountTotal).toBe(1000)

    // 15:00 Argentina -> 18:00 UTC
    const res2 = evaluatePromotions(
      [promo],
      makeContext(lines, { now: new Date('2026-06-15T18:00:00Z') }),
    )
    expect(res2.discountTotal).toBe(0)
  })

  it('17. Sucursal: coincide vs no coincide y branchId nulo', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({ branchIds: ['branch-palermo'], discountValue: 10 })

    const resMatch = evaluatePromotions([promo], makeContext(lines, { branchId: 'branch-palermo' }))
    expect(resMatch.discountTotal).toBe(1000)

    const resNoMatch = evaluatePromotions(
      [promo],
      makeContext(lines, { branchId: 'branch-centro' }),
    )
    expect(resNoMatch.discountTotal).toBe(0)

    const resNull = evaluatePromotions([promo], makeContext(lines, { branchId: null }))
    expect(resNull.discountTotal).toBe(0)
  })

  it('18. Límite total de usos alcanzado', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({ id: 'p1', maxUsesTotal: 10, discountValue: 10 })

    const usage = new Map([['p1', { total: 10, byCustomer: 1 }]])
    const res = evaluatePromotions([promo], makeContext(lines, { usage }))

    expect(res.discountTotal).toBe(0)
  })

  it('19. Límite por cliente alcanzado', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({ id: 'p1', maxUsesPerCustomer: 2, discountValue: 10 })

    const usage = new Map([['p1', { total: 5, byCustomer: 2 }]])
    const res = evaluatePromotions([promo], makeContext(lines, { usage }))

    expect(res.discountTotal).toBe(0)
  })

  it('20. Acumulación de promociones stackable', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo1 = makeCandidate({ id: 'p1', discountValue: 10, stackable: true }) // 1.000
    const promo2 = makeCandidate({ id: 'p2', discountValue: 5, stackable: true }) // 500

    const res = evaluatePromotions([promo1, promo2], makeContext(lines))

    expect(res.discountTotal).toBe(1500)
    expect(res.appliedPromotions).toHaveLength(2)
  })

  it('21. Elección de la mejor exclusiva entre varias', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promoSmall = makeCandidate({ id: 'p1', discountValue: 10, stackable: false }) // 1.000
    const promoBig = makeCandidate({ id: 'p2', discountValue: 20, stackable: false }) // 2.000

    const res = evaluatePromotions([promoSmall, promoBig], makeContext(lines))

    expect(res.discountTotal).toBe(2000)
    expect(res.appliedPromotions).toHaveLength(1)
    expect(res.appliedPromotions[0].promotionId).toBe('p2')
  })

  it('22. Comparación exclusiva vs acumulada (gana la que mayor descuento otorga)', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const exclusive = makeCandidate({ id: 'ex', discountValue: 25, stackable: false }) // 2.500
    const stack1 = makeCandidate({ id: 's1', discountValue: 15, stackable: true }) // 1.500
    const stack2 = makeCandidate({ id: 's2', discountValue: 15, stackable: true }) // 1.500 (total stack = 3.000)

    const res = evaluatePromotions([exclusive, stack1, stack2], makeContext(lines))

    // 3.000 > 2.500 -> ganan las acumuladas
    expect(res.discountTotal).toBe(3000)
    expect(res.appliedPromotions).toHaveLength(2)
  })

  it('23. Cupón válido e inválido', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const coupon = makeCandidate({
      id: 'cp1',
      code: 'DESCUENTO10',
      discountValue: 10,
    })

    // Con código correcto
    const resOk = evaluatePromotions([coupon], makeContext(lines, { requestedCode: 'descuento10' }))
    expect(resOk.discountTotal).toBe(1000)
    expect(resOk.rejectedCode).toBeNull()

    // Con código incorrecto
    const resBad = evaluatePromotions([coupon], makeContext(lines, { requestedCode: 'ERRONEO' }))
    expect(resBad.discountTotal).toBe(0)
    expect(resBad.rejectedCode).toEqual({ code: 'ERRONEO', reason: 'PROMOTION_CODE_NOT_FOUND' })
  })

  it('24. Redondeo: 15% de 3.333 = 500', () => {
    const lines = [line('l1', 'p1', 'c1', 3333, 1)]
    const promo = makeCandidate({ discountValue: 15 })
    const res = evaluatePromotions([promo], makeContext(lines))

    // 3333 * 0.15 = 499.95 -> 500
    expect(res.discountTotal).toBe(500)
    expect(res.total).toBe(2833)
  })

  it('25. Capeo al subtotal cuando la suma de acumulables supera el subtotal', () => {
    const lines = [line('l1', 'p1', 'c1', 5000, 1)]
    const p1 = makeCandidate({
      id: 'p1',
      type: PROMOTION_TYPE.fixedAmount,
      discountValue: 4000,
      stackable: true,
      priority: 10,
    })
    const p2 = makeCandidate({
      id: 'p2',
      type: PROMOTION_TYPE.fixedAmount,
      discountValue: 3000,
      stackable: true,
      priority: 5,
    })

    const res = evaluatePromotions([p1, p2], makeContext(lines))

    expect(res.discountTotal).toBe(5000)
    expect(res.total).toBe(0)
    expect(res.appliedPromotions).toHaveLength(2)
    expect(res.appliedPromotions[0].amount).toBe(4000)
    expect(res.appliedPromotions[1].amount).toBe(1000) // recortada de 3000 a 1000
  })

  it('26. Carrito vacío', () => {
    const promo = makeCandidate()
    const res = evaluatePromotions([promo], makeContext([]))

    expect(res.discountTotal).toBe(0)
    expect(res.total).toBe(0)
    expect(res.appliedPromotions).toHaveLength(0)
  })

  it('27. Promoción legacy (type = null) ignorada', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const legacy = makeCandidate({ type: null, discountValue: 50 })
    const res = evaluatePromotions([legacy], makeContext(lines))

    expect(res.discountTotal).toBe(0)
  })

  it('28. Desempate por prioridad, fin más próximo e ID', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const p1 = makeCandidate({ id: 'p1', discountValue: 10, priority: 5, endDate: '2026-12-31' })
    const p2 = makeCandidate({ id: 'p2', discountValue: 10, priority: 10, endDate: '2026-12-31' })

    const res = evaluatePromotions([p1, p2], makeContext(lines))

    expect(res.appliedPromotions[0].promotionId).toBe('p2') // Mayor prioridad
  })

  it('29. Determinismo: mismo input da mismo output', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 2)]
    const promo = makeCandidate({ discountValue: 15 })
    const ctx = makeContext(lines)

    const res1 = evaluatePromotions([promo], ctx)
    const res2 = evaluatePromotions([promo], ctx)

    expect(res1).toEqual(res2)
  })

  it('30. Fecha inyectada: funciona sin depender de Date.now()', () => {
    const lines = [line('l1', 'p1', 'c1', 10000, 1)]
    const promo = makeCandidate({
      startDate: '2027-01-01T00:00:00Z',
      endDate: '2027-01-31T23:59:59Z',
    })

    const ctxFuture = makeContext(lines, { now: new Date('2027-01-15T12:00:00Z') })
    expect(evaluatePromotions([promo], ctxFuture).discountTotal).toBe(1000)

    const ctxPast = makeContext(lines, { now: new Date('2026-01-15T12:00:00Z') })
    expect(evaluatePromotions([promo], ctxPast).discountTotal).toBe(0)
  })
})
