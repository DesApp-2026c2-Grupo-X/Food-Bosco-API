import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { IngredientController } from './ingredient.controller'
import { Ingredient, IngredientSchema } from './ingredient.model'
import { IngredientRepository } from './ingredient.repository'
import { IngredientService } from './ingredient.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Ingredient.name, schema: IngredientSchema }])],
  controllers: [IngredientController],
  providers: [IngredientRepository, IngredientService],
  exports: [IngredientService],
})
export class IngredientModule {}
