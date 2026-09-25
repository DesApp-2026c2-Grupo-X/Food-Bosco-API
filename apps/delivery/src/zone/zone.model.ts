import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'zones', timestamps: { createdAt: true, updatedAt: true } })
export class Zone {
  @Prop({ required: true, unique: true, index: true, trim: true })
  name!: string

  @Prop({ required: true, type: { latitude: Number, longitude: Number }, _id: false })
  center!: { latitude: number; longitude: number }

  @Prop({ required: true })
  radiusKm!: number

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type ZoneDocument = HydratedDocument<Zone>

export const ZoneSchema = SchemaFactory.createForClass(Zone)

export interface PublicZone {
  id: string
  name: string
  center: { latitude: number; longitude: number }
  radiusKm: number
  active: boolean
}

export const serializeZone = (doc: ZoneDocument): PublicZone => ({
  id: doc._id.toString(),
  name: doc.name,
  center: doc.center,
  radiusKm: doc.radiusKm,
  active: doc.active,
})
