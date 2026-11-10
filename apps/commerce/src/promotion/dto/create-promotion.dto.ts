import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { PROMOTION_SCOPE_VALUES, PROMOTION_TYPE_VALUES } from '../../config/constants'
import type { PromotionScope, PromotionType } from '../../config/constants'
import { IsValidDateRange } from './is-valid-date-range.decorator'

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  @IsValidDateRange({ message: 'La fecha de inicio no puede ser posterior a la fecha de fin' })
  startDate!: string

  @IsDateString()
  endDate!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsIn(PROMOTION_TYPE_VALUES)
  type?: PromotionType

  @IsOptional()
  @IsNumber()
  discountValue?: number

  @IsOptional()
  @IsNumber()
  maxDiscount?: number

  @IsOptional()
  @IsInt()
  buyQuantity?: number

  @IsOptional()
  @IsInt()
  payQuantity?: number

  @IsOptional()
  @IsIn(PROMOTION_SCOPE_VALUES)
  scope?: PromotionScope

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[]

  @IsOptional()
  @IsNumber()
  minSubtotal?: number

  @IsOptional()
  @IsInt()
  minQuantity?: number

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek?: number[]

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsBoolean()
  stackable?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number

  @IsOptional()
  @IsInt()
  maxUsesTotal?: number

  @IsOptional()
  @IsInt()
  maxUsesPerCustomer?: number
}
