import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Roles } from '../config/security/roles.decorator'
import type { PublicIngredient } from './ingredient.model'
import { IngredientService } from './ingredient.service'
import type { IngredientListResponse } from './ingredient.service'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { IngredientQueryDto } from './dto/ingredient-query.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'

@Controller('v1/catalog/ingredients')
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  @Get()
  @Roles(ROLES.superAdmin)
  list(@Query() query: IngredientQueryDto): Promise<IngredientListResponse> {
    return this.ingredientService.list({
      activeOnly: query.activeOnly,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreateIngredientDto): Promise<PublicIngredient> {
    return this.ingredientService.create(dto)
  }

  @Get(':ingredientId')
  async get(@Param('ingredientId') ingredientId: string): Promise<PublicIngredient> {
    const ingredient = await this.ingredientService.findById(ingredientId)
    if (!ingredient) {
      throw new DomainException(ERROR_CODES.ingredientNotFound, 'Ingrediente no encontrado', 404)
    }
    return ingredient
  }

  @Patch(':ingredientId')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('ingredientId') ingredientId: string,
    @Body() dto: UpdateIngredientDto,
  ): Promise<PublicIngredient> {
    const ingredient = await this.ingredientService.update(ingredientId, dto)
    if (!ingredient) {
      throw new DomainException(ERROR_CODES.ingredientNotFound, 'Ingrediente no encontrado', 404)
    }
    return ingredient
  }

  @Patch(':ingredientId/active')
  @Roles(ROLES.superAdmin)
  async setActive(
    @Param('ingredientId') ingredientId: string,
    @Body() dto: SetActiveDto,
  ): Promise<PublicIngredient> {
    const ingredient = await this.ingredientService.setActive(ingredientId, dto.active)
    if (!ingredient) {
      throw new DomainException(ERROR_CODES.ingredientNotFound, 'Ingrediente no encontrado', 404)
    }
    return ingredient
  }
}
