import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { HEADERS, Role } from '../constants'
import { env } from '../env'
import { JwtService } from './jwt.service'
import { ROLES_KEY } from './roles.decorator'
import { AUTHENTICATED_KEY } from './authenticated.decorator'
import { INTERNAL_KEY } from './internal.decorator'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  user?: unknown
}

const headerToString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const requiresAuth = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const allowInternal = this.reflector.getAllAndOverride<boolean>(INTERNAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const request = context.switchToHttp().getRequest<RequestLike>()

    if (allowInternal && headerToString(request.headers?.[HEADERS.internalToken]) === env.internalApiToken) {
      request.user = { authenticated: false, userId: null, roles: [], branchId: null }
      return true
    }

    const authorization = headerToString(request.headers?.[HEADERS.authorization])
    const auth = this.jwtService.verify(authorization)
    request.user = auth

    const rolesNeeded = requiredRoles ?? []
    const needsAuth = requiresAuth || rolesNeeded.length > 0

    if (needsAuth && !auth.authenticated) {
      throw new UnauthorizedException()
    }

    if (rolesNeeded.length > 0 && !rolesNeeded.some((role) => auth.roles.includes(role))) {
      throw new ForbiddenException()
    }

    return true
  }
}
