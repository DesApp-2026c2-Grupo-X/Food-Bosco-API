import { HttpException } from '@nestjs/common'

export class DomainException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
  ) {
    super(message, status)
  }
}
