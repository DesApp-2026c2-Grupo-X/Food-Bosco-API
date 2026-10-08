import { Type } from 'class-transformer'
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator'
import { ORDER_STATUS_VALUES } from '../../config/constants'
import type { OrderStatus } from '../../config/constants'
import { REPORT_GROUP_BY_VALUES } from '../reporting.model'
import type { ReportGroupBy } from '../reporting.model'

export class ReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string

  @IsOptional()
  @IsISO8601()
  to?: string

  @IsOptional()
  @IsString()
  branchId?: string

  @IsOptional()
  @IsIn(REPORT_GROUP_BY_VALUES)
  groupBy?: ReportGroupBy

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsIn(ORDER_STATUS_VALUES)
  status?: OrderStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
