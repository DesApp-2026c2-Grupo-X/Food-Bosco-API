import { Controller, Get, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { ReportQueryDto } from './dto/report-query.dto'
import type { ReportsOverview } from './reporting.model'
import { ReportingService } from './reporting.service'
import type { OutOfStockRow, ProductReportRow, ReportQuery } from './reporting.service'

@Controller('v1/reporting')
@Roles(ROLES.branchAdmin, ROLES.superAdmin)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('overview')
  overview(
    @CurrentUser() auth: AuthContext,
    @Query() query: ReportQueryDto,
  ): Promise<ReportsOverview> {
    return this.reportingService.overview(this.toQuery(auth, query))
  }

  @Get('products/best-sellers')
  bestSellers(
    @CurrentUser() auth: AuthContext,
    @Query() query: ReportQueryDto,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.bestSellers(this.toQuery(auth, query))
  }

  @Get('products/least-sold')
  leastSold(
    @CurrentUser() auth: AuthContext,
    @Query() query: ReportQueryDto,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.leastSold(this.toQuery(auth, query))
  }

  @Get('products/out-of-stock')
  outOfStock(
    @CurrentUser() auth: AuthContext,
    @Query() query: ReportQueryDto,
  ): Promise<OutOfStockRow[]> {
    return this.reportingService.outOfStock(this.resolveBranchId(auth, query.branchId))
  }

  @Get('products/highest-revenue')
  highestRevenue(
    @CurrentUser() auth: AuthContext,
    @Query() query: ReportQueryDto,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.highestRevenue(this.toQuery(auth, query))
  }

  private toQuery(auth: AuthContext, query: ReportQueryDto): ReportQuery {
    return { ...query, branchId: this.resolveBranchId(auth, query.branchId) }
  }

  private resolveBranchId(auth: AuthContext, branchId?: string): string | undefined {
    if (auth.roles.includes(ROLES.superAdmin)) {
      return branchId
    }
    if (!auth.branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin sucursal asignada', 403)
    }
    return auth.branchId
  }
}
