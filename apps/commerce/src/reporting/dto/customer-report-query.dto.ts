import { IsIn, IsISO8601, IsOptional } from 'class-validator'
import { REPORT_GROUP_BY_VALUES } from '../reporting.model'
import type { ReportGroupBy } from '../reporting.model'

export class CustomerReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string

  @IsOptional()
  @IsISO8601()
  to?: string

  @IsOptional()
  @IsIn(REPORT_GROUP_BY_VALUES)
  groupBy?: ReportGroupBy
}
