import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { PasswordRecovery, PasswordRecoveryDocument } from './password-recovery.model'

export interface CreatePasswordRecoveryData {
  userId: string
  tokenHash: string
  expiresAt: Date
}

@Injectable()
export class PasswordRecoveryRepository {
  constructor(
    @InjectModel(PasswordRecovery.name) private readonly model: Model<PasswordRecoveryDocument>,
  ) {}

  create(data: CreatePasswordRecoveryData): Promise<PasswordRecoveryDocument> {
    return this.model.create({ ...data, used: false })
  }

  findByTokenHash(tokenHash: string): Promise<PasswordRecoveryDocument | null> {
    return this.model.findOne({ tokenHash }).exec()
  }

  async markUsedByHash(tokenHash: string): Promise<void> {
    await this.model.updateOne({ tokenHash }, { $set: { used: true } }).exec()
  }
}
