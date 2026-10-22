import { HttpException, HttpStatus, Logger } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { GraphQLError, GraphQLFormattedError } from 'graphql'
import { ERROR_CODES } from '../config/constants'

const logger = new Logger('GraphQLErrorFormatter')

const MESSAGES = {
  internal: 'Ocurrió un error inesperado. Intentá de nuevo en unos instantes.',
  unauthenticated: 'Tu sesión expiró o no es válida. Iniciá sesión nuevamente.',
  forbidden: 'No tenés permisos para realizar esta acción.',
  throttled: 'Demasiados intentos. Esperá un minuto antes de volver a intentarlo.',
} as const

const isTooManyRequests = (error: unknown): boolean =>
  error instanceof ThrottlerException ||
  (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS)

const httpStatusOf = (error: unknown): number | undefined =>
  error instanceof HttpException ? error.getStatus() : undefined

const pickString = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.length > 0)

const DEFAULT_MESSAGES = /^(unauthorized|forbidden|error|throttlerexception.*)$/i

const messageFor = (
  code: string,
  status: number | undefined,
  formattedError: GraphQLFormattedError,
): string => {
  if (code === ERROR_CODES.tooManyRequests) return MESSAGES.throttled
  if (code === ERROR_CODES.internal) return MESSAGES.internal

  const isDefaultMessage = DEFAULT_MESSAGES.test(formattedError.message.trim())

  if (code === ERROR_CODES.unauthenticated || status === HttpStatus.UNAUTHORIZED) {
    return isDefaultMessage ? MESSAGES.unauthenticated : formattedError.message
  }
  if (code === ERROR_CODES.forbidden || status === HttpStatus.FORBIDDEN) {
    return isDefaultMessage ? MESSAGES.forbidden : formattedError.message
  }

  return formattedError.message
}

export const formatGraphQLError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const formattedExtensions = formattedError.extensions
  const errorExtensions = error instanceof GraphQLError ? error.extensions : undefined
  const status = httpStatusOf(error)

  const code = isTooManyRequests(error)
    ? ERROR_CODES.tooManyRequests
    : typeof formattedExtensions?.code === 'string'
      ? formattedExtensions.code
      : typeof errorExtensions?.code === 'string'
        ? errorExtensions.code
        : status === HttpStatus.UNAUTHORIZED
          ? ERROR_CODES.unauthenticated
          : status === HttpStatus.FORBIDDEN
            ? ERROR_CODES.forbidden
            : ERROR_CODES.internal

  const restPath = pickString(formattedExtensions?.path, errorExtensions?.path)
  const details =
    (typeof formattedExtensions?.details === 'object' && formattedExtensions.details) ||
    (typeof errorExtensions?.details === 'object' && errorExtensions.details) ||
    undefined
  const requestId = pickString(formattedExtensions?.requestId, errorExtensions?.requestId)

  if (code === ERROR_CODES.internal) {
    logger.error(
      `${technicalMessageFor(error)}${requestId ? ` (requestId: ${requestId})` : ''}`,
      error instanceof Error ? error.stack : undefined,
    )
  }

  return {
    message: messageFor(code, status, formattedError),
    path: formattedError.path,
    extensions: {
      code,
      ...(restPath ? { path: restPath } : {}),
      ...(details ? { details } : {}),
    },
  }
}

const technicalMessageFor = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
