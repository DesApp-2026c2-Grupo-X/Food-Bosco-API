import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { ProductService } from '../product/product.service'
import type { PublicIngredient } from './ingredient.model'
import { IngredientService } from './ingredient.service'

@Injectable()
export class IngredientOrchestrator {
  constructor(
    private readonly ingredientService: IngredientService,
    private readonly productService: ProductService,
  ) {}

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
