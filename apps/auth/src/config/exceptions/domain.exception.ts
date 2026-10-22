import { HttpException } from '@nestjs/common'

export type DomainErrorDetails = Record<string, unknown>

export class DomainException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
    readonly details?: DomainErrorDetails,
  ) {
    super(message, status)
  }
}
