import { Module } from '@nestjs/common'
import { RestModule } from '../../rest/rest.module'
import {
  BranchStockFieldResolver,
  CartItemFieldResolver,
  OrderFieldResolver,
  ProductFieldResolver,
  RecipeItemFieldResolver,
  TripOrderFieldResolver,
} from './commerce.fields.resolver'
import { CommerceResolver } from './commerce.resolver'

@Module({
  imports: [RestModule],
  providers: [
    CommerceResolver,
    ProductFieldResolver,
    RecipeItemFieldResolver,
    CartItemFieldResolver,
    OrderFieldResolver,
    BranchStockFieldResolver,
    TripOrderFieldResolver,
  ],
})
export class CommerceGraphqlModule {}
