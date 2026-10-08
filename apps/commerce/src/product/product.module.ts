import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { CategoryModule } from '../category/category.module'
import { IngredientModule } from '../ingredient/ingredient.module'
import { ProductController } from './product.controller'
import { Product, ProductSchema } from './product.model'
import { ProductOrchestrator } from './product.orchestrator'
import { ProductRepository } from './product.repository'
import { ProductService } from './product.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    CategoryModule,
    forwardRef(() => IngredientModule),
  ],
  controllers: [ProductController],
  providers: [ProductRepository, ProductService, ProductOrchestrator],
  exports: [ProductService],
})
export class ProductModule {}
