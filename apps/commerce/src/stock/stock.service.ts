import { Injectable } from '@nestjs/common'
import { ERROR_CODES, STOCK_MOVEMENT_REASON } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicBranchStock, serializeBranchStock } from './branch-stock.model'
import { StockRepository } from './stock.repository'

export type IngredientRequirements = Record<string, number>

const INSUFFICIENT_STOCK_MESSAGE = 'No hay stock suficiente para preparar el pedido.'

@Injectable()
export class StockService {
  constructor(private readonly repository: StockRepository) {}

  async list(branchId?: string): Promise<PublicBranchStock[]> {
    const docs = await this.repository.list(branchId)
    return docs.map(serializeBranchStock)
  }

  async adjust(
    branchId: string,
    ingredientId: string,
    delta: number,
    reason?: string,
    orderId?: string | null,
  ): Promise<PublicBranchStock> {
    if (!Number.isInteger(delta)) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'La cantidad a ajustar debe ser un número entero.',
        400,
      )
    }
    if (delta === 0) {
      throw new DomainException(
        ERROR_CODES.validationError,
        'El ajuste de stock no puede ser cero.',
        400,
      )
    }

    const doc =
      delta > 0
        ? await this.repository.increment(branchId, ingredientId, delta)
        : await this.repository.decrementIfAvailable(branchId, ingredientId, -delta)

    if (!doc) {
      const current = await this.repository.findOne(branchId, ingredientId)
      throw this.insufficientStock(ingredientId, -delta, current?.quantity ?? 0)
    }

    await this.repository.createMovement({
      branchId,
      ingredientId,
      delta,
      reason: reason?.trim() ? reason.trim() : STOCK_MOVEMENT_REASON.adjust,
      orderId,
    })

    return serializeBranchStock(doc)
  }

  async validateAvailability(
    branchId: string,
    requirements: IngredientRequirements,
  ): Promise<void> {
    const docs = await this.repository.list(branchId)
    const stockByIngredient = new Map(docs.map((doc) => [doc.ingredientId, doc.quantity]))

    for (const [ingredientId, required] of Object.entries(requirements)) {
      const available = stockByIngredient.get(ingredientId) ?? 0
      if (available < required) {
        throw this.insufficientStock(ingredientId, required, available)
      }
    }
  }

  async discount(
    branchId: string,
    requirements: IngredientRequirements,
    orderId: string,
  ): Promise<void> {
    const applied: IngredientRequirements = {}

    for (const [ingredientId, required] of Object.entries(requirements)) {
      const doc = await this.repository.decrementIfAvailable(branchId, ingredientId, required)

      if (!doc) {
        await this.restore(branchId, applied, orderId)
        const current = await this.repository.findOne(branchId, ingredientId)
        throw this.insufficientStock(ingredientId, required, current?.quantity ?? 0)
      }

      applied[ingredientId] = required
    }

    for (const [ingredientId, required] of Object.entries(applied)) {
      await this.repository.createMovement({
        branchId,
        ingredientId,
        delta: -required,
        reason: STOCK_MOVEMENT_REASON.preparing,
        orderId,
      })
    }
  }

  /**
   * Devuelve stock descontado. Se usa para compensar una operación que no pudo
   * completarse y deja registro del movimiento de ajuste.
   */
  async restore(
    branchId: string,
    requirements: IngredientRequirements,
    orderId?: string | null,
  ): Promise<void> {
    for (const [ingredientId, quantity] of Object.entries(requirements)) {
      await this.repository.increment(branchId, ingredientId, quantity)
      await this.repository.createMovement({
        branchId,
        ingredientId,
        delta: quantity,
        reason: STOCK_MOVEMENT_REASON.adjust,
        orderId,
      })
    }
  }

  private insufficientStock(
    ingredientId: string,
    requestedQuantity: number,
    availableQuantity: number,
  ): DomainException {
    return new DomainException(ERROR_CODES.insufficientStock, INSUFFICIENT_STOCK_MESSAGE, 409, {
      ingredientId,
      requestedQuantity,
      availableQuantity,
    })
  }
}
