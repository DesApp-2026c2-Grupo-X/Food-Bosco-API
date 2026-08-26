import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { RIDER_STATUS, RIDER_STATUS_VALUES } from '../config/constants'
import type { RiderStatus } from '../config/constants'

@Schema({ collection: 'riders', timestamps: { createdAt: true, updatedAt: true } })
export class Rider {
  @Prop({ required: true, unique: true, index: true })
  userId!: string

  @Prop({ required: true, trim: true })
  firstName!: string

  @Prop({ required: true, trim: true })
  lastName!: string

  @Prop({ default: null, type: String, trim: true })
  vehicle!: string | null

  @Prop({ required: true, trim: true })
  phone!: string

  @Prop({ default: false })
  available!: boolean

  @Prop({ required: true, enum: RIDER_STATUS_VALUES, type: String, default: RIDER_STATUS.offline })
  status!: RiderStatus

  @Prop({ type: { latitude: Number, longitude: Number }, default: null, _id: false })
  currentLocation!: { latitude: number; longitude: number } | null

  createdAt!: Date
  updatedAt!: Date
}

export type RiderDocument = HydratedDocument<Rider>

export const RiderSchema = SchemaFactory.createForClass(Rider)

export interface PublicRider {
  id: string
  userId: string
  firstName: string
  lastName: string
  vehicle: string | null
  phone: string
  available: boolean
  status: RiderStatus
  currentLocation: { latitude: number; longitude: number } | null
}

export const serializeRider = (doc: RiderDocument): PublicRider => ({
  id: doc._id.toString(),
  userId: doc.userId,
  firstName: doc.firstName,
  lastName: doc.lastName,
  vehicle: doc.vehicle ?? null,
  phone: doc.phone,
  available: doc.available,
  status: doc.status,
  currentLocation: doc.currentLocation ?? null,
})
