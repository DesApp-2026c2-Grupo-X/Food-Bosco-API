import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { HEADERS, Role } from '../config/constants'
import { JwtService } from './jwt.service'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string> }>()
    const auth = this.jwtService.verify(request.headers?.[HEADERS.authorization])

    if (!auth.authenticated) {
      throw new UnauthorizedException()
    }

    const hasRole = requiredRoles.some((role) => auth.roles.includes(role))
    if (!hasRole) {
      throw new ForbiddenException()
    }

    return true
  }
}
