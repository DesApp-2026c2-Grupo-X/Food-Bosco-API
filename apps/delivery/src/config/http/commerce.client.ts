import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ERROR_CODES, HEADERS } from '../constants'
import { env } from '../env'

interface DownstreamErrorBody {
  code?: string
  message?: string
  path?: string
  details?: Record<string, unknown>
}

const isDownstreamError = (value: unknown): value is DownstreamErrorBody =>
  typeof value === 'object' && value !== null && typeof (value as DownstreamErrorBody).code === 'string'

@Injectable()
export class CommerceClient {
  async patchOrderStatus(orderId: string, status: string): Promise<void> {
    const path = `/v1/orders/${orderId}/status`
    let response: Response

    try {
      response = await fetch(`${env.commerceServiceUrl}${path}`, {
        method: 'PATCH',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          [HEADERS.internalToken]: env.internalApiToken,
        },
        body: JSON.stringify({ status }),
      })
    } catch {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.serviceUnavailable,
        message: 'No pudimos comunicarnos con Commerce. Intentá de nuevo en unos instantes.',
        path,
      })
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as unknown

      if (isDownstreamError(body)) {
        throw new HttpException(
          {
            code: body.code,
            message: body.message ?? 'Commerce no pudo procesar la solicitud.',
            path: body.path ?? path,
            ...(body.details ? { details: body.details } : {}),
          },
          response.status,
        )
      }

      throw new BadGatewayException({
        code: ERROR_CODES.badGateway,
        message: 'Commerce no pudo procesar la solicitud.',
        path,
      })
    }
  }
}
