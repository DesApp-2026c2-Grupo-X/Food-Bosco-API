import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'ingredients', timestamps: { createdAt: true, updatedAt: true } })
export class Ingredient {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, trim: true })
  unit!: string

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type IngredientDocument = HydratedDocument<Ingredient>

export const IngredientSchema = SchemaFactory.createForClass(Ingredient)

export interface PublicIngredient {
  id: string
  name: string
  unit: string
  active: boolean
}

export const serializeIngredient = (doc: IngredientDocument): PublicIngredient => ({
  id: doc._id.toString(),
  name: doc.name,
  unit: doc.unit,
  active: doc.active,
})
