import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'parameters', timestamps: { createdAt: true, updatedAt: true } })
export class Parameter {
  @Prop({ required: true, unique: true, index: true, trim: true })
  key!: string

  @Prop({ required: true })
  value!: number

  @Prop({ required: true, trim: true })
  unit!: string

  createdAt!: Date
  updatedAt!: Date
}

export type ParameterDocument = HydratedDocument<Parameter>

export const ParameterSchema = SchemaFactory.createForClass(Parameter)

export interface PublicParameter {
  key: string
  value: number
  unit: string
}

export const serializeParameter = (doc: ParameterDocument): PublicParameter => ({
  key: doc.key,
  value: doc.value,
  unit: doc.unit,
})
