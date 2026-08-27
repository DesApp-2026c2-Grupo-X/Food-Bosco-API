import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Roles } from '../config/security/roles.decorator'
import type { PublicPromotion } from './promotion.model'
import { PromotionService } from './promotion.service'
import type { PromotionListResponse } from './promotion.service'
import { CreatePromotionDto } from './dto/create-promotion.dto'
import { PromotionQueryDto } from './dto/promotion-query.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { UpdatePromotionDto } from './dto/update-promotion.dto'

@Controller('v1/catalog/promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get()
  @Roles(ROLES.superAdmin)
  list(@Query() query: PromotionQueryDto): Promise<PromotionListResponse> {
    return this.promotionService.list({
      activeOnly: query.activeOnly,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreatePromotionDto): Promise<PublicPromotion> {
    return this.promotionService.create({
      name: dto.name,
      description: dto.description,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    })
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
    const promotion = await this.promotionService.update(promotionId, {
      name: dto.name,
      description: dto.description,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    })
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
}
