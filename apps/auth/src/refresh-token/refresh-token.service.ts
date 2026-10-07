import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { randomToken, sha256 } from '../config/crypto'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { RefreshTokenRepository } from './refresh-token.repository'

@Injectable()
export class RefreshTokenService {
  constructor(private readonly repository: RefreshTokenRepository) {}

  async issue(userId: string): Promise<string> {
    const raw = randomToken()
    const tokenHash = sha256(raw)
    await this.repository.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + env.refreshTokenTtlMs),
    })
    return raw
  }

  async consume(raw: string): Promise<string> {
    const tokenHash = sha256(raw)
    const doc = await this.repository.revokeIfActive(tokenHash)

    if (!doc || doc.expiresAt.getTime() < Date.now()) {
      throw new DomainException(ERROR_CODES.invalidRefreshToken, 'Refresh token inválido', 401)
    }

    return doc.userId
  }

  async revokeAll(userId: string): Promise<void> {
    await this.repository.revokeAllForUser(userId)
  }
}
