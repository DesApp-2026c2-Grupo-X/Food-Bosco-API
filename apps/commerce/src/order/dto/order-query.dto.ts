import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { ORDER_STATUS_VALUES } from '../../config/constants'
import type { OrderStatus } from '../../config/constants'

export class OrderQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUS_VALUES)
  status?: OrderStatus

  @IsOptional()
  @IsString()
  branchId?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
