import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'
import { RIDER_STATUS, RIDER_STATUS_VALUES, VEHICLE_TYPE_VALUES } from '../config/constants'
import type { RiderStatus, VehicleType } from '../config/constants'

export interface Vehicle {
  type: VehicleType
  brand?: string
  model?: string
  plate?: string
}

const VehicleSchema = new MongooseSchema(
  {
    type: { type: String, enum: VEHICLE_TYPE_VALUES, required: true },
    brand: { type: String },
    model: { type: String },
    plate: { type: String },
  },
  { _id: false },
)

@Schema({ collection: 'riders', timestamps: { createdAt: true, updatedAt: true } })
export class Rider {
  @Prop({ required: true, unique: true, index: true })
  userId!: string

  @Prop({ required: true, trim: true })
  firstName!: string

  @Prop({ required: true, trim: true })
  lastName!: string

  @Prop({ type: VehicleSchema, default: null })
  vehicle!: Vehicle | null

  @Prop({ required: true, trim: true })
  phone!: string

  @Prop({ default: false })
  available!: boolean

  @Prop({ required: true, enum: RIDER_STATUS_VALUES, type: String, default: RIDER_STATUS.offline })
  status!: RiderStatus

  @Prop({ type: { latitude: Number, longitude: Number }, default: null, _id: false })
  currentLocation!: { latitude: number; longitude: number } | null

  @Prop({ default: null, type: Date })
  lastSeenAt!: Date | null

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
  vehicle: Vehicle | null
  phone: string
  available: boolean
  status: RiderStatus
  currentLocation: { latitude: number; longitude: number } | null
  lastSeenAt: string | null
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
  lastSeenAt: doc.lastSeenAt?.toISOString() ?? null,
})

export const isRiderStale = (
  rider: PublicRider,
  staleAfterMs: number,
  now: Date = new Date(),
): boolean => {
  if (!rider.lastSeenAt) return true
  return now.getTime() - new Date(rider.lastSeenAt).getTime() > staleAfterMs
}
