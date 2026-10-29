import { Controller, Get, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { CustomerReportQueryDto } from './dto/customer-report-query.dto'
import type { CustomerReportsOverview } from './reporting.model'
import { CustomerReportingService } from './customer-reporting.service'

@Controller('v1/reporting/customer')
@Roles(ROLES.customer)
export class CustomerReportingController {
  constructor(private readonly reportingService: CustomerReportingService) {}

  @Get('overview')
  overview(
    @CurrentUser() auth: AuthContext,
    @Query() query: CustomerReportQueryDto,
  ): Promise<CustomerReportsOverview> {
    if (!auth.userId) {
      throw new DomainException(ERROR_CODES.unauthenticated, 'Identidad no resoluble', 401)
    }

    return this.reportingService.overview(auth.userId, query)
  }
}
