import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type {
  PublicConfigGroup,
  PublicConfigOption,
  PublicProduct,
  PublicRecipeItem,
} from './product.model'
import { ProductService } from './product.service'
import type { ProductListResponse } from './product.service'
import { CreateConfigGroupDto } from './dto/create-config-group.dto'
import { CreateConfigOptionDto } from './dto/create-config-option.dto'
import { CreateProductDto } from './dto/create-product.dto'
import { ProductQueryDto } from './dto/product-query.dto'
import { RecipeItemDto, SetRecipeDto } from './dto/recipe-item.dto'
import { SetAvailableDto } from './dto/set-available.dto'
import { UpdateConfigGroupDto } from './dto/update-config-group.dto'
import { UpdateConfigOptionDto } from './dto/update-config-option.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Controller('v1/catalog/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query() query: ProductQueryDto,
  ): Promise<ProductListResponse> {
    const isAdmin = auth.roles.includes(ROLES.superAdmin)
    const available = query.available ?? (isAdmin ? undefined : true)
    return this.productService.list({
      categoryId: query.categoryId,
      search: query.search,
      available,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreateProductDto): Promise<PublicProduct> {
    return this.productService.create(dto)
  }

  @Get(':productId')
  async get(@Param('productId') productId: string): Promise<PublicProduct> {
    const product = await this.productService.findById(productId)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    return product
  }

  @Patch(':productId')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<PublicProduct> {
    const product = await this.productService.update(productId, dto)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    return product
  }

  @Patch(':productId/available')
  @Roles(ROLES.superAdmin)
  async setAvailable(
    @Param('productId') productId: string,
    @Body() dto: SetAvailableDto,
  ): Promise<PublicProduct> {
    const product = await this.productService.setAvailable(productId, dto.available)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    return product
  }

  @Get(':productId/configurations')
  @Roles(ROLES.superAdmin)
  async listConfigurations(@Param('productId') productId: string): Promise<PublicConfigGroup[]> {
    const product = await this.requireProduct(productId)
    return product.configGroups
  }

  @Post(':productId/configurations')
  @Roles(ROLES.superAdmin)
  async createConfigGroup(
    @Param('productId') productId: string,
    @Body() dto: CreateConfigGroupDto,
  ): Promise<PublicConfigGroup> {
    await this.requireProduct(productId)
    const group = await this.productService.addConfigGroup(productId, dto)
    if (!group) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    return group
  }

  @Patch(':productId/configurations/:groupId')
  @Roles(ROLES.superAdmin)
  async updateConfigGroup(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateConfigGroupDto,
  ): Promise<PublicConfigGroup> {
    await this.requireProduct(productId)
    const group = await this.productService.updateConfigGroup(productId, groupId, dto)
    if (!group) {
      throw new DomainException(ERROR_CODES.configGroupNotFound, 'Grupo no encontrado', 404)
    }
    return group
  }

  @Delete(':productId/configurations/:groupId')
  @Roles(ROLES.superAdmin)
  async removeConfigGroup(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
  ): Promise<{ ok: boolean }> {
    await this.requireProduct(productId)
    const removed = await this.productService.removeConfigGroup(productId, groupId)
    if (!removed) {
      throw new DomainException(ERROR_CODES.configGroupNotFound, 'Grupo no encontrado', 404)
    }
    return { ok: true }
  }

  @Post(':productId/configurations/:groupId/options')
  @Roles(ROLES.superAdmin)
  async createConfigOption(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateConfigOptionDto,
  ): Promise<PublicConfigOption> {
    await this.requireProduct(productId)
    const option = await this.productService.addConfigOption(productId, groupId, dto)
    if (!option) {
      throw new DomainException(ERROR_CODES.configGroupNotFound, 'Grupo no encontrado', 404)
    }
    return option
  }

  @Patch(':productId/configurations/:groupId/options/:optionId')
  @Roles(ROLES.superAdmin)
  async updateConfigOption(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateConfigOptionDto,
  ): Promise<PublicConfigOption> {
    await this.requireProduct(productId)
    const option = await this.productService.updateConfigOption(productId, groupId, optionId, dto)
    if (!option) {
      throw new DomainException(ERROR_CODES.configOptionNotFound, 'Opción no encontrada', 404)
    }
    return option
  }

  @Delete(':productId/configurations/:groupId/options/:optionId')
  @Roles(ROLES.superAdmin)
  async removeConfigOption(
    @Param('productId') productId: string,
    @Param('groupId') groupId: string,
    @Param('optionId') optionId: string,
  ): Promise<{ ok: boolean }> {
    await this.requireProduct(productId)
    const removed = await this.productService.removeConfigOption(productId, groupId, optionId)
    if (!removed) {
      throw new DomainException(ERROR_CODES.configOptionNotFound, 'Opción no encontrada', 404)
    }
    return { ok: true }
  }

  @Get(':productId/recipe')
  @Roles(ROLES.superAdmin)
  async getRecipe(@Param('productId') productId: string): Promise<PublicRecipeItem[]> {
    const product = await this.requireProduct(productId)
    return product.recipe
  }

  @Put(':productId/recipe')
  @Roles(ROLES.superAdmin)
  async setRecipe(
    @Param('productId') productId: string,
    @Body() dto: SetRecipeDto,
  ): Promise<PublicProduct> {
    await this.requireProduct(productId)
    const product = await this.productService.setRecipe(productId, dto.items)
    return product ?? this.notFoundProduct()
  }

  @Post(':productId/recipe/items')
  @Roles(ROLES.superAdmin)
  async addRecipeItem(
    @Param('productId') productId: string,
    @Body() dto: RecipeItemDto,
  ): Promise<PublicProduct> {
    await this.requireProduct(productId)
    const product = await this.productService.addRecipeItem(productId, dto)
    return product ?? this.notFoundProduct()
  }

  @Patch(':productId/recipe/items/:itemId')
  @Roles(ROLES.superAdmin)
  async updateRecipeItem(
    @Param('productId') productId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RecipeItemDto,
  ): Promise<PublicProduct> {
    await this.requireProduct(productId)
    const product = await this.productService.updateRecipeItem(productId, itemId, dto)
    if (!product) {
      throw new DomainException(ERROR_CODES.recipeItemNotFound, 'Ítem de receta no encontrado', 404)
    }
    return product
  }

  @Delete(':productId/recipe/items/:itemId')
  @Roles(ROLES.superAdmin)
  async removeRecipeItem(
    @Param('productId') productId: string,
    @Param('itemId') itemId: string,
  ): Promise<PublicProduct> {
    await this.requireProduct(productId)
    const product = await this.productService.removeRecipeItem(productId, itemId)
    if (!product) {
      throw new DomainException(ERROR_CODES.recipeItemNotFound, 'Ítem de receta no encontrado', 404)
    }
    return product
  }

  private async requireProduct(productId: string): Promise<PublicProduct> {
    const product = await this.productService.findById(productId)
    if (!product) {
      throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
    }
    return product
  }

  private notFoundProduct(): never {
    throw new DomainException(ERROR_CODES.productNotFound, 'Producto no encontrado', 404)
  }
}
