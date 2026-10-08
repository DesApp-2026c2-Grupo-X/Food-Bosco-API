import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { BUSINESS_TIME_ZONE } from '../config/constants'

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
  @Prop({ required: true, unique: true, index: true, trim: true })
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

const argentinaClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

interface ArgentinaClock {
  dayOfWeek: number
  minutes: number
}

const getArgentinaClock = (instant: Date): ArgentinaClock => {
  const parts = argentinaClockFormatter.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  const year = read('year')
  const month = read('month')
  const day = read('day')
  const hour = read('hour')
  const minute = read('minute')

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { dayOfWeek, minutes: hour * 60 + minute }
}

export const isBranchOpenNow = (hours: PublicBranchHour[], now: Date = new Date()): boolean => {
  const { dayOfWeek, minutes } = getArgentinaClock(now)
  const hour = hours.find((entry) => entry.dayOfWeek === dayOfWeek)

  if (!hour || hour.closed) {
    return false
  }

  const opening = timeToMinutes(hour.opening)
  const closing = timeToMinutes(hour.closing)
  if (opening === null || closing === null) {
    return false
  }

  if (closing < opening) {
    return minutes >= opening || minutes < closing
  }

  return minutes >= opening && minutes < closing
}
