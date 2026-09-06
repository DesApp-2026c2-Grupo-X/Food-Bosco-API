import { Inject } from '@nestjs/common'
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { env } from '../../config/env'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import {
  AUTH_REST_CLIENT,
  COMMERCE_REST_CLIENT,
  DELIVERY_REST_CLIENT,
} from '../../rest/rest.module'
import { GeoPoint, mapGeoPoint } from '../common/geo-point'
import { mapUser, User } from '../auth/auth.types'
import { getCommerceLoaders } from './commerce.dataloaders'
import {
  Branch,
  BranchStock,
  CartItem,
  Category,
  ConfigOption,
  Ingredient,
  Order,
  Product,
  RecipeItem,
  mapBranch,
  mapCategory,
  mapIngredient,
  mapProduct,
} from './commerce.types'

type RawRecord = Record<string, unknown>

@Resolver(() => Product)
export class ProductFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('category', () => Category, { nullable: true })
  async category(
    @Parent() product: Product,
    @Context() ctx: GraphQLContext,
  ): Promise<Category | null> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).category.load(
      product.categoryId,
    )
    return raw ? mapCategory(raw) : null
  }
}

@Resolver(() => RecipeItem)
export class RecipeItemFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('ingredient', () => Ingredient, { nullable: true })
  async ingredient(
    @Parent() item: RecipeItem,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient | null> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).ingredient.load(
      item.ingredientId,
    )
    return raw ? mapIngredient(raw) : null
  }
}

@Resolver(() => CartItem)
export class CartItemFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('product', () => Product, { nullable: true })
  async product(@Parent() item: CartItem, @Context() ctx: GraphQLContext): Promise<Product | null> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).product.load(
      item.productId,
    )
    return raw ? mapProduct(raw) : null
  }

  @ResolveField('options', () => [ConfigOption])
  async options(@Parent() item: CartItem, @Context() ctx: GraphQLContext): Promise<ConfigOption[]> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).product.load(
      item.productId,
    )
    if (!raw) {
      return []
    }
    const product = mapProduct(raw)
    return product.configGroups
      .flatMap((group) => group.options)
      .filter((option) => item.optionIds.includes(option.id))
  }
}

@Resolver(() => Order)
export class OrderFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
    @Inject(DELIVERY_REST_CLIENT) private readonly delivery: RestClient,
  ) {}

  @ResolveField('client', () => User, { nullable: true })
  async client(@Parent() order: Order, @Context() ctx: GraphQLContext) {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).user.load(
      order.clientId,
    )
    return raw ? mapUser(raw as RawRecord) : null
  }

  @ResolveField('branch', () => Branch, { nullable: true })
  async branch(@Parent() order: Order, @Context() ctx: GraphQLContext): Promise<Branch | null> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).branch.load(
      order.branchId,
    )
    return raw ? mapBranch(raw) : null
  }

  @ResolveField('riderLocation', () => GeoPoint, { nullable: true })
  async riderLocation(@Parent() order: Order): Promise<GeoPoint | null> {
    if (!order.riderId) {
      return null
    }

    try {
      const raw = await this.delivery.get<RawRecord>(`/v1/riders/by-user/${order.riderId}`, {
        context: { internalToken: env.internalApiToken },
      })
      return mapGeoPoint(raw.currentLocation as RawRecord | undefined)
    } catch {
      return null
    }
  }
}

@Resolver(() => BranchStock)
export class BranchStockFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('ingredient', () => Ingredient, { nullable: true })
  async ingredient(
    @Parent() stock: BranchStock,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient | null> {
    const raw = await getCommerceLoaders(ctx.req, this.commerce, this.auth).ingredient.load(
      stock.ingredientId,
    )
    return raw ? mapIngredient(raw) : null
  }
}
