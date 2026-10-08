import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler'
import { GraphQLError } from 'graphql'
import type { Request, Response } from 'express'
import { ERROR_CODES, HEADERS } from '../config/constants'

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>
  ip?: string
}

@Injectable()
export class GatewayThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context)
    } catch (error) {
      if (context.getType<string>() === 'graphql' && error instanceof ThrottlerException) {
        throw new GraphQLError(error.message, {
          extensions: {
            code: ERROR_CODES.tooManyRequests,
            http: { status: HttpStatus.TOO_MANY_REQUESTS },
          },
        })
      }

      throw error
    }
  }

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
