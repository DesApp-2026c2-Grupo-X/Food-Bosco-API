import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { Authenticated } from '../config/security/authenticated.decorator'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { UserService } from './user.service'
import type { PublicUser } from './user.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('v1/me')
export class MeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Authenticated()
  async me(@CurrentUser() auth: AuthContext): Promise<PublicUser> {
    const user = auth.userId ? await this.userService.findById(auth.userId) : null
    if (!user) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return user
  }

  @Patch()
  @Authenticated()
  async updateMe(@CurrentUser() auth: AuthContext, @Body() dto: UpdateProfileDto): Promise<PublicUser> {
    const user = auth.userId ? await this.userService.update(auth.userId, dto) : null
    if (!user) {
      throw new DomainException(ERROR_CODES.userNotFound, 'Usuario no encontrado', 404)
    }
    return user
  }
}
