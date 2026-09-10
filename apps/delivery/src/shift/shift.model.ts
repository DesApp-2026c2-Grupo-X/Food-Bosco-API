import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'shifts', timestamps: { createdAt: true, updatedAt: true } })
export class Shift {
  @Prop({ required: true, unique: true, index: true, trim: true })
  name!: string

  @Prop({ required: true, trim: true })
  startTime!: string

  @Prop({ required: true, trim: true })
  endTime!: string

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type ShiftDocument = HydratedDocument<Shift>

export const ShiftSchema = SchemaFactory.createForClass(Shift)

export interface PublicShift {
  id: string
  name: string
  startTime: string
  endTime: string
  active: boolean
}

export const serializeShift = (doc: ShiftDocument): PublicShift => ({
  id: doc._id.toString(),
  name: doc.name,
  startTime: doc.startTime,
  endTime: doc.endTime,
  active: doc.active,
})
