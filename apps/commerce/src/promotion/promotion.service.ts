import { Injectable } from '@nestjs/common'
import { ERROR_CODES, PROMOTION_SCOPE, PROMOTION_TYPE } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { AppliedPromotion } from './promotion.engine'
import {
  PromotionDocument,
  PublicBannerPromotion,
  PublicPromotion,
  serializeBannerPromotion,
  serializePromotion,
} from './promotion.model'
import { PromotionRedemptionRepository } from './promotion-redemption.repository'
import {
  CandidateQuery,
  CreatePromotionData,
  PromotionListQuery,
  PromotionRepository,
  UpdatePromotionData,
} from './promotion.repository'

export interface PromotionListResponse {
  data: PublicPromotion[]
  meta: { total: number; limit: number; offset: number }
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export const assertPromotionRules = (
  data: CreatePromotionData | UpdatePromotionData,
  current?: PromotionDocument | null,
): void => {
  const merged = {
    name: data.name ?? current?.name,
    startDate: data.startDate ?? current?.startDate,
    endDate: data.endDate ?? current?.endDate,
    type: data.type !== undefined ? data.type : (current?.type ?? null),
    discountValue:
      data.discountValue !== undefined ? data.discountValue : (current?.discountValue ?? null),
    maxDiscount: data.maxDiscount !== undefined ? data.maxDiscount : (current?.maxDiscount ?? null),
    buyQuantity: data.buyQuantity !== undefined ? data.buyQuantity : (current?.buyQuantity ?? null),
    payQuantity: data.payQuantity !== undefined ? data.payQuantity : (current?.payQuantity ?? null),
    scope: data.scope !== undefined ? data.scope : (current?.scope ?? null),
    categoryIds: data.categoryIds !== undefined ? data.categoryIds : (current?.categoryIds ?? []),
    productIds: data.productIds !== undefined ? data.productIds : (current?.productIds ?? []),
    branchIds: data.branchIds !== undefined ? data.branchIds : (current?.branchIds ?? []),
    minSubtotal: data.minSubtotal !== undefined ? data.minSubtotal : (current?.minSubtotal ?? 0),
    minQuantity: data.minQuantity !== undefined ? data.minQuantity : (current?.minQuantity ?? 0),
    daysOfWeek: data.daysOfWeek !== undefined ? data.daysOfWeek : (current?.daysOfWeek ?? []),
    startTime: data.startTime !== undefined ? data.startTime : (current?.startTime ?? null),
    endTime: data.endTime !== undefined ? data.endTime : (current?.endTime ?? null),
    code: data.code !== undefined ? data.code : (current?.code ?? null),
    stackable: data.stackable !== undefined ? data.stackable : (current?.stackable ?? false),
    priority: data.priority !== undefined ? data.priority : (current?.priority ?? 0),
    maxUsesTotal:
      data.maxUsesTotal !== undefined ? data.maxUsesTotal : (current?.maxUsesTotal ?? null),
    maxUsesPerCustomer:
      data.maxUsesPerCustomer !== undefined
        ? data.maxUsesPerCustomer
        : (current?.maxUsesPerCustomer ?? null),
  }

  if (merged.startDate && merged.endDate) {
    if (merged.startDate.getTime() > merged.endDate.getTime()) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'La fecha de inicio no puede ser posterior a la fecha de fin',
        400,
      )
    }
  }

  if (merged.type) {
    if (!merged.scope) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'El alcance (scope) es obligatorio cuando la promoción tiene un tipo de descuento',
        400,
      )
    }

    if (merged.type === PROMOTION_TYPE.percentage) {
      if (
        merged.discountValue === null ||
        merged.discountValue === undefined ||
        merged.discountValue <= 0 ||
        merged.discountValue > 100
      ) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'El valor de descuento porcentual debe estar entre 1 y 100',
          400,
        )
      }
      if (
        merged.maxDiscount !== null &&
        merged.maxDiscount !== undefined &&
        merged.maxDiscount <= 0
      ) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'El tope máximo de descuento debe ser mayor a 0',
          400,
        )
      }
    } else if (merged.type === PROMOTION_TYPE.fixedAmount) {
      if (
        merged.discountValue === null ||
        merged.discountValue === undefined ||
        merged.discountValue <= 0
      ) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'El valor de descuento fijo debe ser mayor a 0',
          400,
        )
      }
    } else if (merged.type === PROMOTION_TYPE.buyXGetY) {
      if (!merged.buyQuantity || !Number.isInteger(merged.buyQuantity) || merged.buyQuantity < 2) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'La cantidad a llevar (buyQuantity) debe ser un entero mayor o igual a 2',
          400,
        )
      }
      if (
        !merged.payQuantity ||
        !Number.isInteger(merged.payQuantity) ||
        merged.payQuantity < 1 ||
        merged.payQuantity >= merged.buyQuantity
      ) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'La cantidad a pagar (payQuantity) debe ser un entero mayor o igual a 1 y menor a la cantidad a llevar',
          400,
        )
      }
    }

    if (merged.scope === PROMOTION_SCOPE.category) {
      if (!merged.categoryIds || merged.categoryIds.length === 0) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'Debe seleccionar al menos una categoría para el alcance CATEGORY',
          400,
        )
      }
    } else if (merged.scope === PROMOTION_SCOPE.product) {
      if (!merged.productIds || merged.productIds.length === 0) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'Debe seleccionar al menos un producto para el alcance PRODUCT',
          400,
        )
      }
    }

    if (merged.minSubtotal !== undefined && merged.minSubtotal !== null && merged.minSubtotal < 0) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'El subtotal mínimo no puede ser negativo',
        400,
      )
    }

    if (merged.minQuantity !== undefined && merged.minQuantity !== null && merged.minQuantity < 0) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'La cantidad mínima de unidades no puede ser negativa',
        400,
      )
    }

    if (merged.daysOfWeek && merged.daysOfWeek.length > 0) {
      const uniqueDays = new Set(merged.daysOfWeek)
      if (uniqueDays.size !== merged.daysOfWeek.length) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'Los días de la semana no pueden contener duplicados',
          400,
        )
      }
      for (const d of merged.daysOfWeek) {
        if (!Number.isInteger(d) || d < 0 || d > 6) {
          throw new DomainException(
            ERROR_CODES.invalidPromotionRules,
            'Cada día de la semana debe ser un entero entre 0 (domingo) y 6 (sábado)',
            400,
          )
        }
      }
    }

    const hasStart = Boolean(merged.startTime)
    const hasEnd = Boolean(merged.endTime)
    if (hasStart !== hasEnd) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'Debe especificar tanto hora de inicio como de fin, o ninguna',
        400,
      )
    }
    if (hasStart && hasEnd) {
      if (!TIME_REGEX.test(merged.startTime!) || !TIME_REGEX.test(merged.endTime!)) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'El horario debe tener el formato HH:mm (ej. 18:00)',
          400,
        )
      }
    }

    if (merged.code) {
      const codeTrim = merged.code.trim()
      if (codeTrim.length < 3 || codeTrim.length > 20) {
        throw new DomainException(
          ERROR_CODES.invalidPromotionRules,
          'El código de cupón debe tener entre 3 y 20 caracteres',
          400,
        )
      }
    }

    if (
      merged.maxUsesTotal !== null &&
      merged.maxUsesTotal !== undefined &&
      merged.maxUsesTotal < 1
    ) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'El límite total de usos debe ser mayor o igual a 1',
        400,
      )
    }

    if (
      merged.maxUsesPerCustomer !== null &&
      merged.maxUsesPerCustomer !== undefined &&
      merged.maxUsesPerCustomer < 1
    ) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'El límite de usos por cliente debe ser mayor o igual a 1',
        400,
      )
    }

    if (
      merged.priority !== undefined &&
      merged.priority !== null &&
      (!Number.isInteger(merged.priority) || merged.priority < 0 || merged.priority > 100)
    ) {
      throw new DomainException(
        ERROR_CODES.invalidPromotionRules,
        'La prioridad debe ser un entero entre 0 y 100',
        400,
      )
    }
  }
}

@Injectable()
export class PromotionService {
  constructor(
    private readonly repository: PromotionRepository,
    private readonly redemptionRepository?: PromotionRedemptionRepository,
  ) {}

  async list(query: PromotionListQuery): Promise<PromotionListResponse> {
    const { data, total } = await this.repository.list(query)
    return {
      data: data.map(serializePromotion),
      meta: { total, limit: query.limit, offset: query.offset },
    }
  }

  async findById(id: string): Promise<PublicPromotion | null> {
    const doc = await this.repository.findById(id)
    return doc ? serializePromotion(doc) : null
  }

  async findByCode(code: string): Promise<PublicPromotion | null> {
    const doc = await this.repository.findByCode(code)
    return doc ? serializePromotion(doc) : null
  }

  async create(data: CreatePromotionData): Promise<PublicPromotion> {
    assertPromotionRules(data)
    const doc = await this.repository.create(data)
    return serializePromotion(doc)
  }

  async upsertByName(data: CreatePromotionData): Promise<PublicPromotion> {
    const doc = await this.repository.upsertByName(data)
    return serializePromotion(doc!)
  }

  async update(id: string, patch: UpdatePromotionData): Promise<PublicPromotion | null> {
    const hasRuleFields =
      patch.startDate !== undefined ||
      patch.endDate !== undefined ||
      patch.type !== undefined ||
      patch.scope !== undefined ||
      patch.discountValue !== undefined ||
      patch.maxDiscount !== undefined ||
      patch.buyQuantity !== undefined ||
      patch.payQuantity !== undefined ||
      patch.categoryIds !== undefined ||
      patch.productIds !== undefined ||
      patch.branchIds !== undefined ||
      patch.minSubtotal !== undefined ||
      patch.minQuantity !== undefined ||
      patch.daysOfWeek !== undefined ||
      patch.startTime !== undefined ||
      patch.endTime !== undefined ||
      patch.code !== undefined ||
      patch.stackable !== undefined ||
      patch.priority !== undefined ||
      patch.maxUsesTotal !== undefined ||
      patch.maxUsesPerCustomer !== undefined

    if (hasRuleFields) {
      const current = await this.repository.findById(id)
      if (!current) return null
      assertPromotionRules(patch, current)
    }
    const doc = await this.repository.update(id, patch)
    return doc ? serializePromotion(doc) : null
  }

  async setActive(id: string, active: boolean): Promise<PublicPromotion | null> {
    const doc = await this.repository.setActive(id, active)
    return doc ? serializePromotion(doc) : null
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id)
    if (!deleted) {
      throw new DomainException(ERROR_CODES.promotionNotFound, 'Promoción no encontrada', 404)
    }
    return true
  }

  async getCandidates(params: CandidateQuery = {}): Promise<PublicPromotion[]> {
    const docs = await this.repository.findActiveCandidates(params)
    return docs.map(serializePromotion)
  }

  async getPublicActive(now: Date = new Date()): Promise<PublicBannerPromotion[]> {
    const docs = await this.repository.findPublicActive(now)
    return docs.map(serializeBannerPromotion)
  }

  async getUsageMap(
    promotionIds: string[],
    clientId: string,
  ): Promise<Map<string, { total: number; byCustomer: number }>> {
    if (!this.redemptionRepository) return new Map()
    return this.redemptionRepository.getUsageMap(promotionIds, clientId)
  }

  async recordRedemptions(
    orderId: string,
    clientId: string,
    applied: AppliedPromotion[],
  ): Promise<void> {
    if (applied.length === 0 || !this.redemptionRepository) return

    const entries = applied.map((p) => ({
      promotionId: p.promotionId,
      orderId,
      clientId,
      code: p.code,
      amount: p.amount,
    }))

    await this.redemptionRepository.createMany(entries)

    for (const p of applied) {
      await this.repository.incrementUsedCount(p.promotionId, 1)
    }
  }

  async releaseRedemptions(orderId: string): Promise<void> {
    if (!this.redemptionRepository) return
    const released = await this.redemptionRepository.releaseByOrder(orderId)
    for (const r of released) {
      await this.repository.decrementUsedCount(r.promotionId, 1)
    }
  }
}
