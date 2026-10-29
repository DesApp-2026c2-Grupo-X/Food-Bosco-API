import { Type } from 'class-transformer'
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator'
import {
  CUSTOMER_INSIGHTS_MAX_LIMIT,
  CUSTOMER_INSIGHTS_SORT_VALUES,
  REPORT_GROUP_BY_VALUES,
} from '../reporting.model'
import type { CustomerInsightsSort, ReportGroupBy } from '../reporting.model'

export class CustomerInsightsQueryDto {
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
  @IsIn(CUSTOMER_INSIGHTS_SORT_VALUES)
  sortBy?: CustomerInsightsSort

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CUSTOMER_INSIGHTS_MAX_LIMIT)
  limit?: number
}
