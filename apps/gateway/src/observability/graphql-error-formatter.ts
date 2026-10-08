import { HttpException, HttpStatus } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { GraphQLError, GraphQLFormattedError } from 'graphql'
import { ERROR_CODES } from '../config/constants'

const isTooManyRequests = (error: unknown): boolean =>
  error instanceof ThrottlerException ||
  (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS)

export const formatGraphQLError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const formattedExtensions = formattedError.extensions
  const errorExtensions = error instanceof GraphQLError ? error.extensions : undefined

  const code = isTooManyRequests(error)
    ? ERROR_CODES.tooManyRequests
    : typeof formattedExtensions?.code === 'string'
      ? formattedExtensions.code
      : typeof errorExtensions?.code === 'string'
        ? errorExtensions.code
        : ERROR_CODES.internal

  const restPath =
    typeof formattedExtensions?.path === 'string'
      ? formattedExtensions.path
      : typeof errorExtensions?.path === 'string'
        ? errorExtensions.path
        : undefined

  return {
    message: formattedError.message,
    path: formattedError.path,
    extensions: { code, ...(restPath ? { path: restPath } : {}) },
  }
}
