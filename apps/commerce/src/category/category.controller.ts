import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicCategory } from './category.model'
import { CategoryService } from './category.service'
import type { CategoryListResponse } from './category.service'
import { CategoryQueryDto } from './dto/category-query.dto'
import { CreateCategoryDto } from './dto/create-category.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

@Controller('v1/catalog/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query() query: CategoryQueryDto,
  ): Promise<CategoryListResponse> {
    const isAdmin = auth.roles.includes(ROLES.superAdmin)
    const activeOnly = query.activeOnly ?? (isAdmin ? undefined : true)
    return this.categoryService.list({
      activeOnly,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreateCategoryDto): Promise<PublicCategory> {
    return this.categoryService.create(dto)
  }

  @Get(':categoryId')
  async get(@Param('categoryId') categoryId: string): Promise<PublicCategory> {
    const category = await this.categoryService.findById(categoryId)
    if (!category) {
      throw new DomainException(ERROR_CODES.categoryNotFound, 'Categoría no encontrada', 404)
    }
    return category
  }

  @Patch(':categoryId')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<PublicCategory> {
    const category = await this.categoryService.update(categoryId, dto)
    if (!category) {
      throw new DomainException(ERROR_CODES.categoryNotFound, 'Categoría no encontrada', 404)
    }
    return category
  }

  @Patch(':categoryId/active')
  @Roles(ROLES.superAdmin)
  async setActive(
    @Param('categoryId') categoryId: string,
    @Body() dto: SetActiveDto,
  ): Promise<PublicCategory> {
    const category = await this.categoryService.setActive(categoryId, dto.active)
    if (!category) {
      throw new DomainException(ERROR_CODES.categoryNotFound, 'Categoría no encontrada', 404)
    }
    return category
  }
}
