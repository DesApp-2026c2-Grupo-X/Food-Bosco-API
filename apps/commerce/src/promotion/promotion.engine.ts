import { PROMOTION_SCOPE, PROMOTION_TYPE, PromotionScope, PromotionType } from '../config/constants'
import { getArgentinaClock, isWithinTimeWindow } from '../config/time/business-clock'
import { PublicPromotion } from './promotion.model'

export interface PromotableLine {
  lineId: string
  productId: string
  categoryId: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export type PromotionCandidate = PublicPromotion

export interface AppliedPromotion {
  promotionId: string
  name: string
  type: PromotionType
  scope: PromotionScope
  code: string | null
  amount: number
}

export interface PromotionEvaluationContext {
  lines: PromotableLine[]
  subtotal: number
  totalQuantity: number
  branchId: string | null
  clientId: string
  now: Date
  requestedCode: string | null
  usage: Map<string, { total: number; byCustomer: number }>
}

export interface EvaluatedPromotion {
  promotion: PromotionCandidate
  amount: number
}

export interface PricingResult {
  subtotal: number
  discountTotal: number
  total: number
  appliedPromotions: AppliedPromotion[]
  rejectedCode: { code: string; reason: string } | null
}

export const isScheduleMatch = (promotion: PromotionCandidate, now: Date): boolean => {
  const start = new Date(promotion.startDate)
  const end = new Date(promotion.endDate)
  if (now < start || now > end) {
    return false
  }

  const clock = getArgentinaClock(now)

  if (promotion.daysOfWeek && promotion.daysOfWeek.length > 0) {
    if (!promotion.daysOfWeek.includes(clock.dayOfWeek)) {
      return false
    }
  }

  if (promotion.startTime && promotion.endTime) {
    if (!isWithinTimeWindow(clock.minutes, promotion.startTime, promotion.endTime)) {
      return false
    }
  }

  return true
}

export const isBranchMatch = (promotion: PromotionCandidate, branchId: string | null): boolean => {
  if (!promotion.branchIds || promotion.branchIds.length === 0) {
    return true
  }
  if (!branchId) {
    return false
  }
  return promotion.branchIds.includes(branchId)
}

export const selectEligibleLines = (
  promotion: PromotionCandidate,
  lines: PromotableLine[],
): PromotableLine[] => {
  switch (promotion.scope) {
    case PROMOTION_SCOPE.order:
      return lines
    case PROMOTION_SCOPE.category:
      return lines.filter((l) => promotion.categoryIds?.includes(l.categoryId))
    case PROMOTION_SCOPE.product:
      return lines.filter((l) => promotion.productIds?.includes(l.productId))
    default:
      return []
  }
}

export const isUsageMatch = (
  promotion: PromotionCandidate,
  usageMap: Map<string, { total: number; byCustomer: number }>,
): boolean => {
  const stats = usageMap.get(promotion.id) ?? { total: promotion.usedCount ?? 0, byCustomer: 0 }

  if (promotion.maxUsesTotal !== null && stats.total >= promotion.maxUsesTotal) {
    return false
  }
  if (promotion.maxUsesPerCustomer !== null && stats.byCustomer >= promotion.maxUsesPerCustomer) {
    return false
  }
  return true
}

export const calculatePromotionAmount = (
  promotion: PromotionCandidate,
  eligibleLines: PromotableLine[],
  eligibleSubtotal: number,
): number => {
  switch (promotion.type) {
    case PROMOTION_TYPE.percentage: {
      if (promotion.discountValue === null || promotion.discountValue <= 0) return 0
      const raw = Math.round((eligibleSubtotal * promotion.discountValue) / 100)
      const capped = promotion.maxDiscount !== null ? Math.min(raw, promotion.maxDiscount) : raw
      return Math.min(capped, eligibleSubtotal)
    }
    case PROMOTION_TYPE.fixedAmount: {
      if (promotion.discountValue === null || promotion.discountValue <= 0) return 0
      return Math.min(promotion.discountValue, eligibleSubtotal)
    }
    case PROMOTION_TYPE.buyXGetY: {
      if (
        !promotion.buyQuantity ||
        !promotion.payQuantity ||
        promotion.buyQuantity <= promotion.payQuantity
      ) {
        return 0
      }
      const units: number[] = []
      for (const line of eligibleLines) {
        for (let i = 0; i < line.quantity; i++) {
          units.push(line.unitPrice)
        }
      }
      units.sort((a, b) => a - b) // Las más baratas primero

      const groups = Math.floor(units.length / promotion.buyQuantity)
      if (groups === 0) return 0

      const freeUnitsCount = groups * (promotion.buyQuantity - promotion.payQuantity)
      const freeUnits = units.slice(0, freeUnitsCount)
      const discount = freeUnits.reduce((sum, p) => sum + p, 0)
      return Math.min(discount, eligibleSubtotal)
    }
    default:
      return 0
  }
}

export const compareEvaluated = (a: EvaluatedPromotion, b: EvaluatedPromotion): number => {
  // 1. Mayor monto de descuento
  if (b.amount !== a.amount) {
    return b.amount - a.amount
  }
  // 2. Mayor prioridad
  if (b.promotion.priority !== a.promotion.priority) {
    return b.promotion.priority - a.promotion.priority
  }
  // 3. endDate más próxima (vence antes)
  const aEnd = new Date(a.promotion.endDate).getTime()
  const bEnd = new Date(b.promotion.endDate).getTime()
  if (aEnd !== bEnd) {
    return aEnd - bEnd
  }
  // 4. id ascendente
  return a.promotion.id.localeCompare(b.promotion.id)
}

interface SelectionResult {
  applied: EvaluatedPromotion[]
  rejectedCode: { code: string; reason: string } | null
}

export const selectPromotions = (
  evaluated: EvaluatedPromotion[],
  requestedCode: string | null,
  rawCandidates: PromotionCandidate[] = [],
  context?: PromotionEvaluationContext,
): SelectionResult => {
  const normCode = requestedCode ? requestedCode.trim().toUpperCase() : null

  if (normCode) {
    const coupon = evaluated.find(
      (e) => e.promotion.code && e.promotion.code.toUpperCase() === normCode,
    )

    if (!coupon) {
      // Determinar motivo del rechazo del código
      const candidateWithCode = rawCandidates.find(
        (c) => c.code && c.code.toUpperCase() === normCode,
      )
      let reason = 'PROMOTION_CODE_INVALID'
      if (!candidateWithCode) {
        reason = 'PROMOTION_CODE_NOT_FOUND'
      } else if (!candidateWithCode.active) {
        reason = 'PROMOTION_INACTIVE'
      } else if (
        context &&
        (context.now < new Date(candidateWithCode.startDate) ||
          context.now > new Date(candidateWithCode.endDate))
      ) {
        reason = 'PROMOTION_EXPIRED'
      } else if (context && !isBranchMatch(candidateWithCode, context.branchId)) {
        reason = 'PROMOTION_BRANCH_NOT_ALLOWED'
      } else if (context && !isUsageMatch(candidateWithCode, context.usage)) {
        reason = 'PROMOTION_LIMIT_REACHED'
      } else {
        reason = 'PROMOTION_CONDITIONS_NOT_MET'
      }

      return {
        applied: [],
        rejectedCode: { code: normCode, reason },
      }
    }

    if (!coupon.promotion.stackable) {
      return {
        applied: [coupon],
        rejectedCode: null,
      }
    }

    // Cupón acumulable: se suman las automáticas acumulables (sin código)
    const stackableAutos = evaluated.filter(
      (e) => e.promotion.stackable && !e.promotion.code && e !== coupon,
    )
    return {
      applied: [coupon, ...stackableAutos],
      rejectedCode: null,
    }
  }

  // Sin cupón: solo participan promociones automáticas (code === null)
  const automaticEvaluated = evaluated.filter((e) => !e.promotion.code)

  const exclusiveList = automaticEvaluated
    .filter((e) => !e.promotion.stackable)
    .sort(compareEvaluated)
  const stackableList = automaticEvaluated
    .filter((e) => e.promotion.stackable)
    .sort(compareEvaluated)

  const bestExclusive = exclusiveList[0]
  const exclusiveTotal = bestExclusive?.amount ?? 0
  const stackableTotal = stackableList.reduce((sum, e) => sum + e.amount, 0)

  if (exclusiveTotal > stackableTotal && bestExclusive) {
    return { applied: [bestExclusive], rejectedCode: null }
  }

  if (exclusiveTotal === stackableTotal && bestExclusive && stackableList.length > 0) {
    const maxStackablePriority = Math.max(...stackableList.map((e) => e.promotion.priority))
    if (bestExclusive.promotion.priority >= maxStackablePriority) {
      return { applied: [bestExclusive], rejectedCode: null }
    }
    return { applied: stackableList, rejectedCode: null }
  }

  if (stackableTotal > 0) {
    return { applied: stackableList, rejectedCode: null }
  }

  if (bestExclusive) {
    return { applied: [bestExclusive], rejectedCode: null }
  }

  return { applied: [], rejectedCode: null }
}

export const capToSubtotal = (
  applied: EvaluatedPromotion[],
  subtotal: number,
): { applied: EvaluatedPromotion[]; total: number } => {
  if (applied.length === 0 || subtotal <= 0) {
    return { applied: [], total: 0 }
  }

  let runningTotal = 0
  const result: EvaluatedPromotion[] = []

  for (const entry of applied) {
    if (runningTotal >= subtotal) {
      break
    }
    const remaining = subtotal - runningTotal
    const actualAmount = Math.min(entry.amount, remaining)
    if (actualAmount > 0) {
      result.push({
        promotion: entry.promotion,
        amount: actualAmount,
      })
      runningTotal += actualAmount
    }
  }

  return { applied: result, total: runningTotal }
}

export const evaluatePromotions = (
  candidates: PromotionCandidate[],
  context: PromotionEvaluationContext,
): PricingResult => {
  if (context.lines.length === 0 || context.subtotal <= 0) {
    return {
      subtotal: context.subtotal,
      discountTotal: 0,
      total: Math.max(0, context.subtotal),
      appliedPromotions: [],
      rejectedCode: context.requestedCode
        ? { code: context.requestedCode, reason: 'CART_EMPTY' }
        : null,
    }
  }

  const evaluated: EvaluatedPromotion[] = []

  for (const promotion of candidates) {
    // Si no tiene tipo de descuento (legacy informativa), se ignora
    if (!promotion.type) continue
    if (!promotion.active) continue

    if (!isScheduleMatch(promotion, context.now)) continue
    if (!isBranchMatch(promotion, context.branchId)) continue

    const eligibleLines = selectEligibleLines(promotion, context.lines)
    const eligibleSubtotal = eligibleLines.reduce((sum, l) => sum + l.subtotal, 0)
    const eligibleQuantity = eligibleLines.reduce((sum, l) => sum + l.quantity, 0)

    if (eligibleQuantity === 0) continue
    if (promotion.minSubtotal && eligibleSubtotal < promotion.minSubtotal) continue
    if (promotion.minQuantity && eligibleQuantity < promotion.minQuantity) continue
    if (!isUsageMatch(promotion, context.usage)) continue

    const amount = calculatePromotionAmount(promotion, eligibleLines, eligibleSubtotal)
    if (amount <= 0) continue

    evaluated.push({ promotion, amount })
  }

  const selection = selectPromotions(evaluated, context.requestedCode, candidates, context)

  const capped = capToSubtotal(selection.applied, context.subtotal)

  return {
    subtotal: context.subtotal,
    discountTotal: capped.total,
    total: Math.max(0, context.subtotal - capped.total),
    appliedPromotions: capped.applied.map((e) => ({
      promotionId: e.promotion.id,
      name: e.promotion.name,
      type: e.promotion.type!,
      scope: e.promotion.scope!,
      code: e.promotion.code ?? null,
      amount: e.amount,
    })),
    rejectedCode: selection.rejectedCode,
  }
}
