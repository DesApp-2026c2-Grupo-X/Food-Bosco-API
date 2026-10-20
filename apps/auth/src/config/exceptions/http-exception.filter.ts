import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { ERROR_CODES, HEADERS } from '../constants'
import { DomainException } from './domain.exception'

type ErrorBody =
  | string
  | { code?: string; message?: string | string[]; details?: Record<string, unknown> }

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.validationError,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.unauthenticated,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.forbidden,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.notFound,
  [HttpStatus.CONFLICT]: ERROR_CODES.conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.unprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.tooManyRequests,
  [HttpStatus.BAD_GATEWAY]: ERROR_CODES.badGateway,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.serviceUnavailable,
}

const codeForStatus = (status: number): string => STATUS_CODES[status] ?? ERROR_CODES.internal

const extractMessage = (body: ErrorBody): string => {
  if (typeof body === 'string') return body

  const message = body.message
  if (Array.isArray(message)) return message.join('; ')
  return message ?? 'Error'
}

const extractCode = (body: ErrorBody, status: number): string =>
  typeof body === 'object' && typeof body.code === 'string' && body.code
    ? body.code
    : codeForStatus(status)

const extractDetails = (body: ErrorBody): Record<string, unknown> | undefined =>
  typeof body === 'object' && body.details ? body.details : undefined

const requestIdFrom = (request: Request): string | undefined => {
  const header = request.headers?.[HEADERS.requestId]
  return Array.isArray(header) ? header[0] : header
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const path = request.url
    const requestId = requestIdFrom(request)
    const withCorrelation = <T extends Record<string, unknown>>(body: T): T =>
      requestId ? { ...body, requestId } : body

    if (exception instanceof DomainException) {
      response.status(exception.getStatus()).json(
        withCorrelation({
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
          path,
        }),
      )
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse() as ErrorBody
      const details = extractDetails(body)
      response.status(status).json(
        withCorrelation({
          code: extractCode(body, status),
          message: extractMessage(body),
          ...(details ? { details } : {}),
          path,
        }),
      )
      return
    }

    if (exception instanceof mongoose.Error.CastError) {
      response
        .status(HttpStatus.NOT_FOUND)
        .json(withCorrelation({ code: ERROR_CODES.notFound, message: 'Recurso no encontrado', path }))
      return
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      withCorrelation({
        code: ERROR_CODES.internal,
        message: 'Error interno del servidor',
        path,
      }),
    )
  }
}
