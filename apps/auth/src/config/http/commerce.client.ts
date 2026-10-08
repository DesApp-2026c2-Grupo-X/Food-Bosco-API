import {
  BadGatewayException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { HEADERS } from '../constants'
import { env } from '../env'

export const DEFAULT_COMMERCE_TIMEOUT_MS = 5_000

const isAbortError = (error: unknown): boolean => {
  const name = (error as { name?: string } | null | undefined)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

@Injectable()
export class CommerceClient {
  private readonly timeoutMs: number

  constructor(@Optional() timeoutMs: number = DEFAULT_COMMERCE_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs
  }

  async branchExists(branchId: string): Promise<boolean> {
    let response: Response
    try {
      response = await fetch(
        `${env.commerceServiceUrl}/v1/branches/${encodeURIComponent(branchId)}`,
        {
          headers: {
            accept: 'application/json',
            [HEADERS.internalToken]: env.internalApiToken,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      )
    } catch (error) {
      if (isAbortError(error)) {
        throw new ServiceUnavailableException(`Commerce no respondió en ${this.timeoutMs}ms`)
      }
      throw new ServiceUnavailableException('Commerce no disponible')
    }

    if (response.status === 404) {
      return false
    }

    if (!response.ok) {
      throw new BadGatewayException(`Commerce devolvió HTTP ${response.status}`)
    }

    return true
  }
}
