import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { BranchOrchestrator } from './branch.orchestrator'
import type { BranchProductListResponse } from './branch.orchestrator'
import type { PublicBranch, PublicBranchHour } from './branch.model'
import { BranchService } from './branch.service'
import type { BranchListResponse } from './branch.service'
import { BranchHourDto, UpdateBranchHoursDto } from './dto/branch-hours.dto'
import { BranchQueryDto } from './dto/branch-query.dto'
import { CreateBranchDto } from './dto/create-branch.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { SetProductAvailabilityDto } from './dto/set-product-availability.dto'
import { UpdateBranchDto } from './dto/update-branch.dto'

const toHour = (dto: BranchHourDto) => ({
  dayOfWeek: dto.dayOfWeek,
  opening: dto.opening ?? null,
  closing: dto.closing ?? null,
  closed: dto.closed,
})

@Controller('v1/branches')
export class BranchController {
  constructor(
    private readonly branchService: BranchService,
    private readonly orchestrator: BranchOrchestrator,
  ) {}

  @Get()
  @Roles(ROLES.superAdmin)
  list(@Query() query: BranchQueryDto): Promise<BranchListResponse> {
    return this.branchService.list({
      active: query.active,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Post()
  @Roles(ROLES.superAdmin)
  create(@Body() dto: CreateBranchDto): Promise<PublicBranch> {
    return this.branchService.create(dto)
  }

  @Get('available')
  async available(@Query('lat') lat: string, @Query('lng') lng: string): Promise<PublicBranch[]> {
    return this.branchService.findAvailable(Number(lat), Number(lng))
  }

  @Get(':branchId')
  async get(@Param('branchId') branchId: string): Promise<PublicBranch> {
    const branch = await this.branchService.findById(branchId)
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
    return branch
  }

  @Patch(':branchId')
  @Roles(ROLES.superAdmin)
  async update(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<PublicBranch> {
    const branch = await this.branchService.update(branchId, dto)
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
    return branch
  }

  @Patch(':branchId/active')
  @Roles(ROLES.superAdmin)
  async setActive(
    @Param('branchId') branchId: string,
    @Body() dto: SetActiveDto,
  ): Promise<PublicBranch> {
    const branch = await this.branchService.setActive(branchId, dto.active)
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
    return branch
  }

  @Get(':branchId/hours')
  async getHours(@Param('branchId') branchId: string): Promise<PublicBranchHour[]> {
    const branch = await this.branchService.findById(branchId)
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
    return branch.hours
  }

  @Put(':branchId/hours')
  @Roles(ROLES.superAdmin)
  async updateHours(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchHoursDto,
  ): Promise<PublicBranchHour[]> {
    const branch = await this.branchService.updateHours(branchId, dto.hours.map(toHour))
    if (!branch) {
      throw new DomainException(ERROR_CODES.branchNotFound, 'Sucursal no encontrada', 404)
    }
    return branch.hours
  }

  @Get(':branchId/products')
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async listProducts(
    @CurrentUser() auth: AuthContext,
    @Param('branchId') branchId: string,
  ): Promise<BranchProductListResponse> {
    this.assertBranchAccess(auth, branchId)
    return this.orchestrator.listProducts(branchId)
  }

  @Patch(':branchId/products/:productId/availability')
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async setProductAvailability(
    @CurrentUser() auth: AuthContext,
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
    @Body() dto: SetProductAvailabilityDto,
  ): Promise<{ ok: boolean }> {
    this.assertBranchAccess(auth, branchId)
    await this.branchService.setProductAvailability(branchId, productId, dto.available)
    return { ok: true }
  }

  private assertBranchAccess(auth: AuthContext, branchId: string): void {
    if (auth.roles.includes(ROLES.superAdmin)) {
      return
    }
    if (auth.branchId !== branchId) {
      throw new DomainException(ERROR_CODES.forbidden, 'Sin acceso a esta sucursal', 403)
    }
  }
}
