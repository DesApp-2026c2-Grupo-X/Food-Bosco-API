import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { USER_ROLE_VALUES } from '../config/constants'
import type { Role } from '../config/constants'

@Schema({ collection: 'users', timestamps: { createdAt: true, updatedAt: false } })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string

  @Prop({ required: true, select: false })
  passwordHash!: string

  @Prop({ required: true, enum: USER_ROLE_VALUES, type: String })
  role!: Role

  @Prop({ required: true, trim: true })
  firstName!: string

  @Prop({ required: true, trim: true })
  lastName!: string

  @Prop({ required: true, trim: true })
  phone!: string

  @Prop({ default: true })
  active!: boolean

  @Prop({ default: null, type: String })
  branchId!: string | null

  @Prop({ default: null, type: String })
  vehicle!: string | null

  createdAt!: Date
}

export type UserDocument = HydratedDocument<User>

export const UserSchema = SchemaFactory.createForClass(User)

export interface PublicUser {
  id: string
  email: string
  role: Role
  firstName: string
  lastName: string
  phone: string
  active: boolean
  branchId: string | null
  vehicle: string | null
  createdAt: string
}

export const serializeUser = (doc: UserDocument): PublicUser => ({
  id: doc._id.toString(),
  email: doc.email,
  role: doc.role,
  firstName: doc.firstName,
  lastName: doc.lastName,
  phone: doc.phone,
  active: doc.active,
  branchId: doc.branchId ?? null,
  vehicle: doc.vehicle ?? null,
  createdAt: doc.createdAt?.toISOString() ?? '',
})
