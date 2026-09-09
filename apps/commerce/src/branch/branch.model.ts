import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export interface BranchHour {
  dayOfWeek: number
  opening: string | null
  closing: string | null
  closed: boolean
}

@Schema({ _id: false })
export class BranchHours {
  @Prop({ required: true })
  dayOfWeek!: number

  @Prop({ default: null, type: String })
  opening!: string | null

  @Prop({ default: null, type: String })
  closing!: string | null

  @Prop({ default: false })
  closed!: boolean
}

export const BranchHoursSchema = SchemaFactory.createForClass(BranchHours)

@Schema({ collection: 'branches', timestamps: { createdAt: true, updatedAt: true } })
export class Branch {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, trim: true })
  addressText!: string

  @Prop({ required: true })
  latitude!: number

  @Prop({ required: true })
  longitude!: number

  @Prop({ default: null, type: String, trim: true })
  phone!: string | null

  @Prop({ default: true })
  active!: boolean

  @Prop({ type: [BranchHoursSchema], default: [] })
  hours!: BranchHours[]

  createdAt!: Date
  updatedAt!: Date
}

export type BranchDocument = HydratedDocument<Branch>

export const BranchSchema = SchemaFactory.createForClass(Branch)

export interface PublicBranchHour {
  dayOfWeek: number
  opening: string | null
  closing: string | null
  closed: boolean
}

export interface PublicBranch {
  id: string
  name: string
  addressText: string
  latitude: number
  longitude: number
  phone: string | null
  active: boolean
  hours: PublicBranchHour[]
}

const serializeHour = (hour: BranchHours): PublicBranchHour => ({
  dayOfWeek: hour.dayOfWeek,
  opening: hour.opening ?? null,
  closing: hour.closing ?? null,
  closed: hour.closed,
})

export const serializeBranch = (doc: BranchDocument): PublicBranch => ({
  id: doc._id.toString(),
  name: doc.name,
  addressText: doc.addressText,
  latitude: doc.latitude,
  longitude: doc.longitude,
  phone: doc.phone ?? null,
  active: doc.active,
  hours: doc.hours.map(serializeHour),
})

const timeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export const isBranchOpenNow = (hours: PublicBranchHour[], now: Date = new Date()): boolean => {
  const dayOfWeek = now.getDay()
  const hour = hours.find((entry) => entry.dayOfWeek === dayOfWeek)

  if (!hour || hour.closed) {
    return false
  }

  const opening = timeToMinutes(hour.opening)
  const closing = timeToMinutes(hour.closing)
  if (opening === null || closing === null) {
    return false
  }

  const current = now.getHours() * 60 + now.getMinutes()
  return current >= opening && current < closing
}
