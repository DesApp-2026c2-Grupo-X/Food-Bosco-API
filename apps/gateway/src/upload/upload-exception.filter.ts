import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ERROR_CODES } from '../config/constants'

type ErrorPayload = { code?: string; message?: string | string[]; path?: string }

const codeForStatus = (status: number): string => {
  if (status === HttpStatus.UNAUTHORIZED) return ERROR_CODES.unauthenticated
  if (status === HttpStatus.FORBIDDEN) return ERROR_CODES.forbidden
  if (status === HttpStatus.BAD_REQUEST) return ERROR_CODES.badRequest
  if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) return ERROR_CODES.invalidImageType
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) return ERROR_CODES.payloadTooLarge
  return ERROR_CODES.internal
}

const FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo en unos instantes.'

const extractMessage = (payload: ErrorPayload): string => {
  if (Array.isArray(payload.message)) return payload.message.join('; ')
  return payload.message ?? FALLBACK_MESSAGE
}

const translateDefaultMessage = (message: string, status: number): string => {
  const normalized = message.trim()

  if (status === HttpStatus.UNAUTHORIZED && /^unauthorized$/i.test(normalized)) {
    return 'Tu sesión expiró o no es válida. Iniciá sesión nuevamente.'
  }
  if (status === HttpStatus.FORBIDDEN && /^forbidden$/i.test(normalized)) {
    return 'No tenés permisos para realizar esta acción.'
  }
  if (/^error$/i.test(normalized)) {
    return FALLBACK_MESSAGE
  }

  return message
}

@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const raw = exception.getResponse()
      const payload: ErrorPayload = typeof raw === 'string' ? { message: raw } : raw

      response.status(status).json({
        code: payload.code ?? codeForStatus(status),
        message: translateDefaultMessage(extractMessage(payload), status),
        path: payload.path ?? request.url,
      })
      return
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODES.internal,
      message: 'Error interno del servidor',
      path: request.url,
    })
  }
}
