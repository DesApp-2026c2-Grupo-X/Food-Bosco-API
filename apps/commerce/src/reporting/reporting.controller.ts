import { Controller, Get, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { ReportingService } from './reporting.service'
import type { OutOfStockRow, ProductReportRow } from './reporting.service'

@Controller('v1/reporting/products')
@Roles(ROLES.branchAdmin, ROLES.superAdmin)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('best-sellers')
  bestSellers(
    @CurrentUser() auth: AuthContext,
    @Query('branchId') branchId?: string,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.bestSellers(this.resolveBranchId(auth, branchId))
  }

  @Get('least-sold')
  leastSold(
    @CurrentUser() auth: AuthContext,
    @Query('branchId') branchId?: string,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.leastSold(this.resolveBranchId(auth, branchId))
  }

  @Get('out-of-stock')
  outOfStock(
    @CurrentUser() auth: AuthContext,
    @Query('branchId') branchId?: string,
  ): Promise<OutOfStockRow[]> {
    return this.reportingService.outOfStock(this.resolveBranchId(auth, branchId))
  }

  @Get('highest-revenue')
  highestRevenue(
    @CurrentUser() auth: AuthContext,
    @Query('branchId') branchId?: string,
  ): Promise<ProductReportRow[]> {
    return this.reportingService.highestRevenue(this.resolveBranchId(auth, branchId))
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
