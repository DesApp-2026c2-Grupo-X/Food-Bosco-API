import { Injectable } from '@nestjs/common'
import { ERROR_CODES, STOCK_MOVEMENT_REASON } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { PublicBranchStock, serializeBranchStock } from './branch-stock.model'
import { StockRepository } from './stock.repository'

export type IngredientRequirements = Record<string, number>

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
    orderId?: string | null,
  ): Promise<PublicBranchStock> {
    const current = await this.repository.findOne(branchId, ingredientId)
    const quantity = Math.max(0, (current?.quantity ?? 0) + delta)

    const doc = await this.repository.setQuantity(branchId, ingredientId, quantity)
    await this.repository.createMovement({
      branchId,
      ingredientId,
      delta,
      reason: STOCK_MOVEMENT_REASON.adjust,
      orderId,
    })

    return doc ? serializeBranchStock(doc) : { ingredientId, branchId, quantity }
  }

  async validateAvailability(branchId: string, requirements: IngredientRequirements): Promise<void> {
    const docs = await this.repository.list(branchId)
    const stockByIngredient = new Map(docs.map((doc) => [doc.ingredientId, doc.quantity]))

    for (const [ingredientId, required] of Object.entries(requirements)) {
      const available = stockByIngredient.get(ingredientId) ?? 0
      if (available < required) {
        throw new DomainException(
          ERROR_CODES.insufficientStock,
          `Stock insuficiente para el ingrediente ${ingredientId}`,
          409,
        )
      }
    }
  }

  async discount(branchId: string, requirements: IngredientRequirements, orderId: string): Promise<void> {
    const docs = await this.repository.list(branchId)
    const stockByIngredient = new Map(docs.map((doc) => [doc.ingredientId, doc.quantity]))

    for (const [ingredientId, required] of Object.entries(requirements)) {
      const available = stockByIngredient.get(ingredientId) ?? 0
      const next = Math.max(0, available - required)

      await this.repository.setQuantity(branchId, ingredientId, next)
      await this.repository.createMovement({
        branchId,
        ingredientId,
        delta: -required,
        reason: STOCK_MOVEMENT_REASON.preparing,
        orderId,
      })
    }
  }
}
