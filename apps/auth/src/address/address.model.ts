import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'addresses', timestamps: { createdAt: true, updatedAt: true } })
export class Address {
  @Prop({ required: true, index: true })
  userId!: string

  @Prop({ required: true, trim: true })
  label!: string

  @Prop({ required: true, trim: true })
  text!: string

  @Prop({ trim: true })
  city?: string

  @Prop({ trim: true })
  postalCode?: string

  @Prop({ required: true })
  latitude!: number

  @Prop({ required: true })
  longitude!: number

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type AddressDocument = HydratedDocument<Address>

export const AddressSchema = SchemaFactory.createForClass(Address)

export interface PublicAddress {
  id: string
  label: string
  text: string
  city: string | null
  postalCode: string | null
  latitude: number
  longitude: number
  active: boolean
}

export const serializeAddress = (doc: AddressDocument): PublicAddress => ({
  id: doc._id.toString(),
  label: doc.label,
  text: doc.text,
  city: doc.city ?? null,
  postalCode: doc.postalCode ?? null,
  latitude: doc.latitude,
  longitude: doc.longitude,
  active: doc.active,
})
