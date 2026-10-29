import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BranchModule } from '../branch/branch.module'
import { ProductModule } from '../product/product.module'
import { StockModule } from '../stock/stock.module'
import { IngredientController } from './ingredient.controller'
import { Ingredient, IngredientSchema } from './ingredient.model'
import { IngredientOrchestrator } from './ingredient.orchestrator'
import { IngredientRepository } from './ingredient.repository'
import { IngredientService } from './ingredient.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ingredient.name, schema: IngredientSchema }]),
    forwardRef(() => ProductModule),
    forwardRef(() => BranchModule),
    StockModule,
  ],
  controllers: [IngredientController],
  providers: [IngredientRepository, IngredientService, IngredientOrchestrator],
  exports: [IngredientService],
})
export class IngredientModule {}
