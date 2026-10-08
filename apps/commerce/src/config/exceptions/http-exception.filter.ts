import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'

type ErrorBody = string | { message?: string | string[] }

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

const extractMessage = (body: ErrorBody): string => {
  if (typeof body === 'string') return body

  const message = body.message
  if (Array.isArray(message)) return message.join('; ')
  return message ?? 'Error'
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const path = request.url

    if (exception instanceof DomainException) {
      response
        .status(exception.getStatus())
        .json({ code: exception.code, message: exception.message, path })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      response.status(status).json({
        code: codeForStatus(status),
        message: extractMessage(exception.getResponse() as ErrorBody),
        path,
      })
      return
    }

    // INT-02: un id de path que no es ObjectId hace que Mongoose lance `CastError`.
    // Se traduce a 404 (recurso no encontrado) en lugar de filtrar un 500.
    if (isCastError(exception)) {
      response.status(HttpStatus.NOT_FOUND).json({
        code: ERROR_CODES.notFound,
        message: 'Recurso no encontrado',
        path,
      })
      return
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: ERROR_CODES.internal, message: 'Error interno del servidor', path })
  }
}
