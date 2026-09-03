import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { BranchModule } from './branch/branch.module'
import { CartModule } from './cart/cart.module'
import { CategoryModule } from './category/category.module'
import { DatabaseModule } from './config/database/database.module'
import { SecurityModule } from './config/security/security.module'
import { RequestIdMiddleware } from './config/observability/request-id.middleware'
import { HealthModule } from './health/health.module'
import { IngredientModule } from './ingredient/ingredient.module'
import { OrderModule } from './order/order.module'
import { OrderStateModule } from './order-state/order-state.module'
import { ParameterModule } from './parameter/parameter.module'
import { ProductModule } from './product/product.module'
import { PromotionModule } from './promotion/promotion.module'
import { ReportingModule } from './reporting/reporting.module'
import { SeedModule } from './seed/seed.module'
import { StockModule } from './stock/stock.module'

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    HealthModule,
    CategoryModule,
    ProductModule,
    IngredientModule,
    PromotionModule,
    BranchModule,
    CartModule,
    OrderModule,
    StockModule,
    ReportingModule,
    ParameterModule,
    OrderStateModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
