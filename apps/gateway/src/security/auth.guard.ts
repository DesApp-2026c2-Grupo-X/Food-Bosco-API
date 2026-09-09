import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { Role } from '../config/constants'
import { AUTHENTICATED_KEY } from './authenticated.decorator'
import { ROLES_KEY } from './roles.decorator'

type GraphQLContext = {
  authenticated?: boolean
  roles?: Role[]
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const requiresAuth = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const rolesNeeded = requiredRoles ?? []
    if (!requiresAuth && rolesNeeded.length === 0) {
      return true
    }

    const gqlContext = GqlExecutionContext.create(context).getContext<GraphQLContext>()
    const authenticated = gqlContext.authenticated ?? false
    const roles = gqlContext.roles ?? []

    if (!authenticated) {
      throw new UnauthorizedException()
    }

    if (rolesNeeded.length > 0 && !rolesNeeded.some((role) => roles.includes(role))) {
      throw new ForbiddenException()
    }

    return true
  }
}
