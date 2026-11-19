import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Roles } from '../config/security/roles.decorator'
import { CreatePromotionDto } from './dto/create-promotion.dto'
import { PromotionQueryDto } from './dto/promotion-query.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { UpdatePromotionDto } from './dto/update-promotion.dto'
import type { PublicBannerPromotion, PublicPromotion } from './promotion.model'
import { PromotionOrchestrator } from './promotion.orchestrator'
import { PromotionService, type PromotionListResponse } from './promotion.service'

@Controller('v1/catalog/promotions')
export class PromotionController {
  constructor(
    private readonly promotionService: PromotionService,
    private readonly orchestrator?: PromotionOrchestrator,
  ) {}

  @Get()
  @Roles(ROLES.superAdmin)
  list(@Query() query: PromotionQueryDto): Promise<PromotionListResponse> {
    return this.promotionService.list({
      activeOnly: query.activeOnly === undefined ? undefined : query.activeOnly === true,
      type: query.type,
      scope: query.scope,
      code: query.code,
      branchId: query.branchId,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Get('public')
  getPublic(): Promise<PublicBannerPromotion[]> {
    return this.promotionService.getPublicActive()
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreatePromotionDto): Promise<PublicPromotion> {
    const payload = {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    }
    return this.orchestrator
      ? this.orchestrator.create(payload)
      : this.promotionService.create(payload)
  }

  @Get(':promotionId')
  @Roles(ROLES.superAdmin)
  async get(@Param('promotionId') promotionId: string): Promise<PublicPromotion> {
    const promotion = await this.promotionService.findById(promotionId)
    if (!promotion) {
      throw new DomainException(ERROR_CODES.promotionNotFound, 'Promoción no encontrada', 404)
    }
    return promotion
  }

  @Patch(':promotionId')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('promotionId') promotionId: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PublicPromotion> {
    const payload = {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    }
    const promotion = this.orchestrator
      ? await this.orchestrator.update(promotionId, payload)
      : await this.promotionService.update(promotionId, payload)
    if (!promotion) {
      throw new DomainException(ERROR_CODES.promotionNotFound, 'Promoción no encontrada', 404)
    }
    return promotion
  }

  @Patch(':promotionId/active')
  @Roles(ROLES.superAdmin)
  async setActive(
    @Param('promotionId') promotionId: string,
    @Body() dto: SetActiveDto,
  ): Promise<PublicPromotion> {
    const promotion = await this.promotionService.setActive(promotionId, dto.active)
    if (!promotion) {
      throw new DomainException(ERROR_CODES.promotionNotFound, 'Promoción no encontrada', 404)
    }
    return promotion
  }

  @Delete(':promotionId')
  @Roles(ROLES.superAdmin)
  async delete(@Param('promotionId') promotionId: string): Promise<{ success: boolean }> {
    const success = await this.promotionService.delete(promotionId)
    if (!success) {
      throw new DomainException(ERROR_CODES.promotionNotFound, 'Promoción no encontrada', 404)
    }
    return { success }
  }
}
