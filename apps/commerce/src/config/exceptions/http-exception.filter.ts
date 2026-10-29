import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ERROR_CODES, HEADERS } from '../constants'
import { DomainException } from './domain.exception'

type ErrorBody =
  string | { code?: string; message?: string | string[]; details?: Record<string, unknown> }

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.validationError,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.unauthenticated,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.forbidden,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.notFound,
  [HttpStatus.CONFLICT]: ERROR_CODES.conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.unprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.tooManyRequests,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODES.payloadTooLarge,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ERROR_CODES.invalidImageType,
}

const codeForStatus = (status: number): string => STATUS_CODES[status] ?? ERROR_CODES.internal

const isCastError = (exception: unknown): boolean =>
  exception instanceof Error && exception.name === 'CastError'

const FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo en unos instantes.'

const extractMessage = (body: ErrorBody): string => {
  if (typeof body === 'string') return body

  const message = body.message
  if (Array.isArray(message)) return message.join('; ')
  return message ?? FALLBACK_MESSAGE
}

const translateDefaultMessage = (message: string, status: number): string => {
  const normalized = message.trim()

  if (status === HttpStatus.UNAUTHORIZED && /^unauthorized$/i.test(normalized)) {
    return 'Tu sesión expiró o no es válida. Iniciá sesión nuevamente.'
  }
  if (status === HttpStatus.FORBIDDEN && /^forbidden$/i.test(normalized)) {
    return 'No tenés permisos para realizar esta acción.'
  }
  if (status === HttpStatus.NOT_FOUND && /^not found$/i.test(normalized)) {
    return 'Recurso no encontrado'
  }
  if (status === HttpStatus.INTERNAL_SERVER_ERROR && /^internal server error$/i.test(normalized)) {
    return 'Error interno del servidor'
  }
  if (/^error$/i.test(normalized)) {
    return FALLBACK_MESSAGE
  }

  return message
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
          message: translateDefaultMessage(extractMessage(body), status),
          ...(details ? { details } : {}),
          path,
        }),
      )
      return
    }

    // INT-02: un id de path que no es ObjectId hace que Mongoose lance `CastError`.
    // Se traduce a 404 (recurso no encontrado) en lugar de filtrar un 500.
    if (isCastError(exception)) {
      response
        .status(HttpStatus.NOT_FOUND)
        .json(
          withCorrelation({ code: ERROR_CODES.notFound, message: 'Recurso no encontrado', path }),
        )
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
