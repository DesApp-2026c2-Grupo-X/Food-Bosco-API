import { Injectable } from '@nestjs/common'
import { BranchService } from '../branch/branch.service'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { ProductService } from '../product/product.service'
import { StockService } from '../stock/stock.service'
import type { PublicIngredient } from './ingredient.model'
import type { CreateIngredientData } from './ingredient.repository'
import { IngredientService } from './ingredient.service'

@Injectable()
export class IngredientOrchestrator {
  constructor(
    private readonly ingredientService: IngredientService,
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreateIngredientData): Promise<PublicIngredient> {
    const ingredient = await this.ingredientService.create(dto)
    const { data: branches } = await this.branchService.list({ limit: 500, offset: 0 })
    if (branches.length > 0) {
      await this.stockService.ensureStockRows(
        branches.map((branch) => branch.id),
        [ingredient.id],
      )
    }
    return ingredient
  }

  async setActive(id: string, active: boolean): Promise<PublicIngredient | null> {
    if (!active) {
      const inUse = await this.productService.isIngredientInUse(id)
      if (inUse) {
        throw new DomainException(
          ERROR_CODES.ingredientInUse,
          'El ingrediente está en uso por una receta activa',
          409,
        )
      }
    }
    return this.ingredientService.setActive(id, active)
  }
}
