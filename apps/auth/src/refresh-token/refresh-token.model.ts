import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'refreshTokens', timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ required: true, index: true })
  userId!: string

  @Prop({ required: true, unique: true })
  tokenHash!: string

  @Prop({ required: true })
  expiresAt!: Date

  @Prop({ default: false })
  revoked!: boolean

  createdAt!: Date
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken)
