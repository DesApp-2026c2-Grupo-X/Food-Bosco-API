import { Module } from '@nestjs/common'
import { RestModule } from '../../rest/rest.module'
import {
  BranchStockFieldResolver,
  CartItemFieldResolver,
  CustomerInsightsRowFieldResolver,
  OrderFieldResolver,
  ProductFieldResolver,
  RecipeItemFieldResolver,
  TripOrderFieldResolver,
} from './commerce.fields.resolver'
import { CommerceResolver } from './commerce.resolver'
import { HomeFeedResolver } from './home-feed.resolver'
import {
  BranchRatingRowFieldResolver,
  CourierRatingRowFieldResolver,
  OrderReviewFieldResolver,
  ReviewsResolver,
} from './reviews.resolver'

@Module({
  imports: [RestModule],
  providers: [
    CommerceResolver,
    HomeFeedResolver,
    ReviewsResolver,
    OrderReviewFieldResolver,
    BranchRatingRowFieldResolver,
    CourierRatingRowFieldResolver,
    ProductFieldResolver,
    RecipeItemFieldResolver,
    CartItemFieldResolver,
    CustomerInsightsRowFieldResolver,
    OrderFieldResolver,
    BranchStockFieldResolver,
    TripOrderFieldResolver,
  ],
})
export class CommerceGraphqlModule {}
