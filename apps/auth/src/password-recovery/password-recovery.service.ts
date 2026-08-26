import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { randomToken, sha256 } from '../config/crypto'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { PasswordRecoveryRepository } from './password-recovery.repository'

@Injectable()
export class PasswordRecoveryService {
  constructor(private readonly repository: PasswordRecoveryRepository) {}

  async create(userId: string): Promise<string> {
    const raw = randomToken()
    const tokenHash = sha256(raw)
    await this.repository.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + env.passwordRecoveryTtlMs),
    })
    return raw
  }

  async consume(raw: string): Promise<string> {
    const tokenHash = sha256(raw)
    const doc = await this.repository.findByTokenHash(tokenHash)

    if (!doc || doc.used || doc.expiresAt.getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.invalidOrExpiredToken, 'Token inválido o expirado', 400)
    }

    await this.repository.markUsedByHash(tokenHash)
    return doc.userId
  }
}
