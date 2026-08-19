import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'

type ErrorBody = string | { message?: string | string[] }

const codeForStatus = (status: number): string => {
  if (status === HttpStatus.UNAUTHORIZED) return ERROR_CODES.unauthenticated
  if (status === HttpStatus.FORBIDDEN) return ERROR_CODES.forbidden
  if (status === HttpStatus.BAD_REQUEST) return ERROR_CODES.validationError
  if (status === HttpStatus.NOT_FOUND) return ERROR_CODES.notFound
  return ERROR_CODES.internal
}

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
      response
        .status(status)
        .json({
          code: codeForStatus(status),
          message: extractMessage(exception.getResponse() as ErrorBody),
          path,
        })
      return
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: ERROR_CODES.internal, message: 'Error interno del servidor', path })
  }
}
