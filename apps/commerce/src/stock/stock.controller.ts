import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicBranchStock } from './branch-stock.model'
import { StockService } from './stock.service'
import { AdjustStockDto } from './dto/adjust-stock.dto'

@Controller('v1/stock')
@Roles(ROLES.branchAdmin, ROLES.superAdmin)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  list(
    @CurrentUser() auth: AuthContext,
    @Query('branchId') branchId?: string,
  ): Promise<PublicBranchStock[]> {
    return this.stockService.list(this.resolveBranchId(auth, branchId))
  }

  @Post('adjustments')
  adjust(
    @CurrentUser() auth: AuthContext,
    @Body() dto: AdjustStockDto,
  ): Promise<PublicBranchStock> {
    const branchId = this.resolveBranchId(auth, dto.branchId)
    if (!branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin sucursal asignada', 403)
    }
    return this.stockService.adjust(branchId, dto.ingredientId, dto.delta)
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
