import { Controller, Get, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { CustomerInsightsQueryDto } from './dto/customer-insights-query.dto'
import type { CustomerInsightsOverview } from './reporting.model'
import { CustomerInsightsService } from './customer-insights.service'

@Controller('v1/reporting/customers')
@Roles(ROLES.branchAdmin, ROLES.superAdmin)
export class CustomerInsightsController {
  constructor(private readonly customerInsightsService: CustomerInsightsService) {}

  @Get('insights')
  insights(
    @CurrentUser() auth: AuthContext,
    @Query() query: CustomerInsightsQueryDto,
  ): Promise<CustomerInsightsOverview> {
    return this.customerInsightsService.overview({
      ...query,
      branchId: this.resolveBranchId(auth, query.branchId),
    })
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
