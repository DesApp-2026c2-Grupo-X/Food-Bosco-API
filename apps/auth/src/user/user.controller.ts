import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Internal } from '../config/security/internal.decorator'
import { Roles } from '../config/security/roles.decorator'
import { UserService } from './user.service'
import type { PublicUser, UserListResponse } from './user.service'
import { CreateAdminDto } from './dto/create-admin.dto'
import { CreateRiderDto } from './dto/create-rider.dto'
import { CreateStaffDto } from './dto/create-staff.dto'
import { SetActiveDto } from './dto/set-active.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserQueryDto } from './dto/user-query.dto'

@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private async requireEditable(userId: string): Promise<void> {
    const target = await this.userService.findById(userId)
    if (!target) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    if (target.role === ROLES.superAdmin) {
      throw new DomainException(
        ERROR_CODES.forbidden,
        'Los admins globales no se pueden editar ni desactivar',
        403,
      )
    }
  }

  @Get()
  @Roles(ROLES.superAdmin)
  list(@Query() query: UserQueryDto): Promise<UserListResponse> {
    return this.userService.list({
      role: query.role,
      active: query.active,
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Get(':userId')
  @Roles(ROLES.superAdmin)
  @Internal()
  async get(@Param('userId') userId: string): Promise<PublicUser> {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return user
  }

  @Post('staff')
  @Roles(ROLES.superAdmin)
  createStaff(@Body() dto: CreateStaffDto): Promise<PublicUser> {
    return this.userService.createUser({ ...dto, role: ROLES.branchAdmin })
  }

  @Post('admins')
  @Roles(ROLES.superAdmin)
  createAdmin(@Body() dto: CreateAdminDto): Promise<PublicUser> {
    return this.userService.createUser({ ...dto, role: ROLES.superAdmin })
  }

  @Post('riders')
  @Roles(ROLES.superAdmin)
  createRider(@Body() dto: CreateRiderDto): Promise<PublicUser> {
    return this.userService.createUser({ ...dto, role: ROLES.rider })
  }

  @Patch(':userId')
  @Roles(ROLES.superAdmin)
  async update(@Param('userId') userId: string, @Body() dto: UpdateUserDto): Promise<PublicUser> {
    await this.requireEditable(userId)
    const user = await this.userService.update(userId, dto)
    if (!user) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return user
  }

  @Patch(':userId/active')
  @Roles(ROLES.superAdmin)
  async setActive(@Param('userId') userId: string, @Body() dto: SetActiveDto): Promise<PublicUser> {
    await this.requireEditable(userId)
    const user = await this.userService.setActive(userId, dto.active)
    if (!user) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return user
  }
}
