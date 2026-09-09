import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'passwordRecovery', timestamps: { createdAt: true, updatedAt: false } })
export class PasswordRecovery {
  @Prop({ required: true, index: true })
  userId!: string

  @Prop({ required: true })
  tokenHash!: string

  @Prop({ required: true })
  expiresAt!: Date

  @Prop({ default: false })
  used!: boolean

  createdAt!: Date
}

export type PasswordRecoveryDocument = HydratedDocument<PasswordRecovery>

export const PasswordRecoverySchema = SchemaFactory.createForClass(PasswordRecovery)
