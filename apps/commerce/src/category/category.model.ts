import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

@Schema({ collection: 'categories', timestamps: { createdAt: true, updatedAt: true } })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ default: true })
  active!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export type CategoryDocument = HydratedDocument<Category>

export const CategorySchema = SchemaFactory.createForClass(Category)

export interface PublicCategory {
  id: string
  name: string
  active: boolean
}

export const serializeCategory = (doc: CategoryDocument): PublicCategory => ({
  id: doc._id.toString(),
  name: doc.name,
  active: doc.active,
})
