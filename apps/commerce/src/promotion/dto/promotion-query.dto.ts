import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { PROMOTION_SCOPE_VALUES, PROMOTION_TYPE_VALUES } from '../../config/constants'
import type { PromotionScope, PromotionType } from '../../config/constants'

export class PromotionQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return value
  })
  @IsBoolean()
  activeOnly?: boolean | string

  @IsOptional()
  @IsIn(PROMOTION_TYPE_VALUES)
  type?: PromotionType

  @IsOptional()
  @IsIn(PROMOTION_SCOPE_VALUES)
  scope?: PromotionScope

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsString()
  branchId?: string

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
