import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProductModule } from '../product/product.module'
import { IngredientController } from './ingredient.controller'
import { Ingredient, IngredientSchema } from './ingredient.model'
import { IngredientOrchestrator } from './ingredient.orchestrator'
import { IngredientRepository } from './ingredient.repository'
import { IngredientService } from './ingredient.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ingredient.name, schema: IngredientSchema }]),
    forwardRef(() => ProductModule),
  ],
  controllers: [IngredientController],
  providers: [IngredientRepository, IngredientService, IngredientOrchestrator],
  exports: [IngredientService],
})
export class IngredientModule {}
