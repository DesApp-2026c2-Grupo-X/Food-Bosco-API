import { ExecutionContext, Injectable } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { HEADERS } from '../config/constants'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  ip?: string
}

@Injectable()
export class GatewayThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext): {
    req: Request
    res: Response
  } {
    if (context.getType<string>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req?: Request
        res?: Response
      }>()

      return { req: gqlContext.req ?? ({} as Request), res: gqlContext.res ?? ({} as Response) }
    }

    const http = context.switchToHttp()
    return { req: http.getRequest<Request>(), res: http.getResponse<Response>() }
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as RequestLike
    const authorization = request.headers?.[HEADERS.authorization]

    if (typeof authorization === 'string' && authorization.length > 0) {
      return Promise.resolve(authorization)
    }

    return Promise.resolve(request.ip ?? 'anonymous')
  }
}
