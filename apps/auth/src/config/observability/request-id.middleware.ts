import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { HEADERS } from '../constants'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADERS.requestId]
    const requestId = Array.isArray(incoming) ? incoming[0] : (incoming ?? randomUUID())

    req.headers[HEADERS.requestId] = requestId
    res.setHeader(HEADERS.requestId, requestId)

    next()
  }
}
