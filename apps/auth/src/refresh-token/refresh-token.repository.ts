import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RefreshToken, RefreshTokenDocument } from './refresh-token.model'

export interface CreateRefreshTokenData {
  userId: string
  tokenHash: string
  expiresAt: Date
}

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectModel(RefreshToken.name) private readonly model: Model<RefreshTokenDocument>,
  ) {}

  create(data: CreateRefreshTokenData): Promise<RefreshTokenDocument> {
    return this.model.create({ ...data, revoked: false })
  }

  findByTokenHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash }).exec()
  }

  async markRevokedByHash(tokenHash: string): Promise<void> {
    await this.model.updateOne({ tokenHash }, { $set: { revoked: true } }).exec()
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.model.updateMany({ userId, revoked: false }, { $set: { revoked: true } }).exec()
  }
}
