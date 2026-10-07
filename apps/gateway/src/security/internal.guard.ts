import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { HEADERS } from '../config/constants'
import { env } from '../config/env'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
}

const headerToString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>()
    const token = headerToString(request.headers?.[HEADERS.internalToken])

    if (token !== env.internalApiToken) {
      throw new UnauthorizedException()
    }

    return true
  }
}
