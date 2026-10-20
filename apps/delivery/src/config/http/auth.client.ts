import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ERROR_CODES, HEADERS } from '../constants'
import { env } from '../env'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  phone: string
  vehicle: string | null
  role: string
}

interface DownstreamErrorBody {
  code?: string
  message?: string
  path?: string
  details?: Record<string, unknown>
}

const isDownstreamError = (value: unknown): value is DownstreamErrorBody =>
  typeof value === 'object' && value !== null && typeof (value as DownstreamErrorBody).code === 'string'

@Injectable()
export class AuthClient {
  async getUser(userId: string): Promise<AuthUser | null> {
    const path = `/v1/users/${userId}`
    let response: Response

    try {
      response = await fetch(`${env.authServiceUrl}${path}`, {
        headers: {
          accept: 'application/json',
          [HEADERS.internalToken]: env.internalApiToken,
        },
      })
    } catch {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.serviceUnavailable,
        message: 'No pudimos comunicarnos con Auth. Intentá de nuevo en unos instantes.',
        path,
      })
    }

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as unknown

      if (isDownstreamError(body)) {
        throw new HttpException(
          {
            code: body.code,
            message: body.message ?? 'Auth no pudo procesar la solicitud.',
            path: body.path ?? path,
            ...(body.details ? { details: body.details } : {}),
          },
          response.status,
        )
      }

      throw new BadGatewayException({
        code: ERROR_CODES.badGateway,
        message: 'Auth no pudo procesar la solicitud.',
        path,
      })
    }

    return (await response.json()) as AuthUser
  }
}
