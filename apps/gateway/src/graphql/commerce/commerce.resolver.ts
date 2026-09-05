import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { ROLES } from '../../config/constants'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { AUTH_REST_CLIENT, COMMERCE_REST_CLIENT } from '../../rest/rest.module'
import { AuthGuard } from '../../security/auth.guard'
import { Authenticated } from '../../security/authenticated.decorator'
import { Roles } from '../../security/roles.decorator'
import { PageInput } from '../common/page'
import { toRestContext } from '../common/rest-context'
import { OrderStatus, orderStatusToRest } from '../common/order-status.enum'
import {
  AddCartItemInput,
  AdjustStockInput,
  BranchFilterInput,
  BranchHoursInput,
  BranchInput,
  CategoryInput,
  ConfigGroupInput,
  ConfigOptionInput,
  IngredientInput,
  OrderFilterInput,
  OrderStateInput,
  ProductFilterInput,
  ProductInput,
  PromotionInput,
  RecipeItemInput,
  UpdateCartItemInput,
} from './commerce.inputs'
import {
  Branch,
  BranchHours,
  BranchStock,
  Cart,
  Category,
  ConfigGroup,
  ConfigOption,
  Ingredient,
  Order,
  OrderState,
  OrderStatusHistory,
  OutOfStockRow,
  Parameter,
  Product,
  ProductReportRow,
  Promotion,
  RepeatOrderResult,
  mapBranch,
  mapBranchHour,
  mapBranchStock,
  mapCart,
  mapCategory,
  mapConfigGroup,
  mapConfigOption,
  mapIngredient,
  mapOrder,
  mapOrderState,
  mapOrderStatusHistory,
  mapOutOfStockRow,
  mapParameter,
  mapProduct,
  mapProductReportRow,
  mapPromotion,
} from './commerce.types'

type RawRecord = Record<string, unknown>

interface ListRest {
  data: RawRecord[]
}

@Resolver()
@UseGuards(AuthGuard)
export class CommerceResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly rest: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly authRest: RestClient,
  ) {}

  @Query(() => [Category])
  async categories(
    @Args('activeOnly', { type: () => Boolean, nullable: true }) activeOnly: boolean | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Category[]> {
    const raw = await this.rest.get<ListRest>('/v1/catalog/categories', {
      context: toRestContext(ctx),
      query: { activeOnly: activeOnly ?? undefined, limit: page?.limit, offset: page?.offset },
    })
    return raw.data.map(mapCategory)
  }

  @Query(() => Category)
  async category(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Category> {
    const raw = await this.rest.get<RawRecord>(`/v1/catalog/categories/${id}`, {
      context: toRestContext(ctx),
    })
    return mapCategory(raw)
  }

  @Query(() => [Product])
  async products(
    @Args('filter', { type: () => ProductFilterInput, nullable: true })
    filter: ProductFilterInput | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Product[]> {
    const raw = await this.rest.get<ListRest>('/v1/catalog/products', {
      context: toRestContext(ctx),
      query: {
        categoryId: filter?.categoryId ?? undefined,
        search: filter?.search ?? undefined,
        available: filter?.available,
        limit: page?.limit,
        offset: page?.offset,
      },
    })
    return raw.data.map(mapProduct)
  }

  @Query(() => Product)
  async product(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.get<RawRecord>(`/v1/catalog/products/${id}`, {
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Query(() => [Ingredient])
  @Roles(ROLES.superAdmin)
  async ingredients(
    @Args('activeOnly', { type: () => Boolean, nullable: true }) activeOnly: boolean | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient[]> {
    const raw = await this.rest.get<ListRest>('/v1/catalog/ingredients', {
      context: toRestContext(ctx),
      query: { activeOnly: activeOnly ?? undefined, limit: page?.limit, offset: page?.offset },
    })
    return raw.data.map(mapIngredient)
  }

  @Query(() => Ingredient)
  async ingredient(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient> {
    const raw = await this.rest.get<RawRecord>(`/v1/catalog/ingredients/${id}`, {
      context: toRestContext(ctx),
    })
    return mapIngredient(raw)
  }

  @Query(() => [Promotion])
  @Roles(ROLES.superAdmin)
  async promotions(
    @Args('activeOnly', { type: () => Boolean, nullable: true }) activeOnly: boolean | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Promotion[]> {
    const raw = await this.rest.get<ListRest>('/v1/catalog/promotions', {
      context: toRestContext(ctx),
      query: { activeOnly: activeOnly ?? undefined, limit: page?.limit, offset: page?.offset },
    })
    return raw.data.map(mapPromotion)
  }

  @Query(() => Promotion)
  @Roles(ROLES.superAdmin)
  async promotion(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Promotion> {
    const raw = await this.rest.get<RawRecord>(`/v1/catalog/promotions/${id}`, {
      context: toRestContext(ctx),
    })
    return mapPromotion(raw)
  }

  @Query(() => [Branch])
  @Roles(ROLES.superAdmin)
  async branches(
    @Args('filter', { type: () => BranchFilterInput, nullable: true })
    filter: BranchFilterInput | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch[]> {
    const raw = await this.rest.get<ListRest>('/v1/branches', {
      context: toRestContext(ctx),
      query: {
        active: filter?.active,
        search: filter?.search ?? undefined,
        limit: page?.limit,
        offset: page?.offset,
      },
    })
    return raw.data.map(mapBranch)
  }

  @Query(() => Branch)
  async branch(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch> {
    const raw = await this.rest.get<RawRecord>(`/v1/branches/${id}`, {
      context: toRestContext(ctx),
    })
    return mapBranch(raw)
  }

  @Query(() => [BranchHours])
  async branchHours(
    @Args('branchId', { type: () => ID }) branchId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<BranchHours[]> {
    const raw = await this.rest.get<RawRecord[]>(`/v1/branches/${branchId}/hours`, {
      context: toRestContext(ctx),
    })
    return raw.map(mapBranchHour)
  }

  @Query(() => [Branch])
  async availableBranches(
    @Args('lat') lat: number,
    @Args('lng') lng: number,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/branches/available', {
      context: toRestContext(ctx),
      query: { lat, lng },
    })
    return raw.map(mapBranch)
  }

  @Query(() => [Product])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async branchProducts(
    @Args('branchId', { type: () => ID }) branchId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Product[]> {
    const raw = await this.rest.get<ListRest>(`/v1/branches/${branchId}/products`, {
      context: toRestContext(ctx),
    })
    return raw.data.map((entry) => ({
      ...mapProduct(entry),
      available: Boolean(entry.availableInBranch),
    }))
  }

  @Query(() => Cart)
  @Roles(ROLES.customer)
  async myCart(@Context() ctx: GraphQLContext): Promise<Cart> {
    const raw = await this.rest.get<RawRecord>('/v1/carts', { context: toRestContext(ctx) })
    return mapCart(raw)
  }

  @Query(() => [Order])
  @Roles(ROLES.customer)
  async myOrders(
    @Args('filter', { type: () => OrderFilterInput, nullable: true })
    filter: OrderFilterInput | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Order[]> {
    return this.listOrders(ctx, filter, page)
  }

  @Query(() => [Order])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async orders(
    @Args('filter', { type: () => OrderFilterInput, nullable: true })
    filter: OrderFilterInput | null,
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Order[]> {
    return this.listOrders(ctx, filter, page)
  }

  @Query(() => Order)
  @Authenticated()
  async order(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Order> {
    const raw = await this.rest.get<RawRecord>(`/v1/orders/${id}`, {
      context: toRestContext(ctx),
    })
    return mapOrder(raw)
  }

  @Query(() => [OrderStatusHistory])
  @Authenticated()
  async orderHistory(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderStatusHistory[]> {
    const raw = await this.rest.get<RawRecord[]>(`/v1/orders/${id}/history`, {
      context: toRestContext(ctx),
    })
    return raw.map(mapOrderStatusHistory)
  }

  @Query(() => [BranchStock])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async branchStock(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Context() ctx: GraphQLContext,
  ): Promise<BranchStock[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/stock', {
      context: toRestContext(ctx),
      query: { branchId: branchId ?? undefined },
    })
    return raw.map(mapBranchStock)
  }

  @Query(() => [ProductReportRow])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async bestSellingProducts(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Context() ctx: GraphQLContext,
  ): Promise<ProductReportRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reporting/products/best-sellers', {
      context: toRestContext(ctx),
      query: { branchId: branchId ?? undefined },
    })
    return raw.map(mapProductReportRow)
  }

  @Query(() => [ProductReportRow])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async leastSoldProducts(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Context() ctx: GraphQLContext,
  ): Promise<ProductReportRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reporting/products/least-sold', {
      context: toRestContext(ctx),
      query: { branchId: branchId ?? undefined },
    })
    return raw.map(mapProductReportRow)
  }

  @Query(() => [OutOfStockRow])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async outOfStockProducts(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Context() ctx: GraphQLContext,
  ): Promise<OutOfStockRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reporting/products/out-of-stock', {
      context: toRestContext(ctx),
      query: { branchId: branchId ?? undefined },
    })
    return raw.map(mapOutOfStockRow)
  }

  @Query(() => [ProductReportRow])
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async highestRevenueProducts(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Context() ctx: GraphQLContext,
  ): Promise<ProductReportRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reporting/products/highest-revenue', {
      context: toRestContext(ctx),
      query: { branchId: branchId ?? undefined },
    })
    return raw.map(mapProductReportRow)
  }

  @Query(() => [Parameter])
  @Roles(ROLES.superAdmin)
  async parameters(@Context() ctx: GraphQLContext): Promise<Parameter[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/config/parameters', {
      context: toRestContext(ctx),
    })
    return raw.map(mapParameter)
  }

  @Query(() => [OrderState])
  @Authenticated()
  async orderStates(@Context() ctx: GraphQLContext): Promise<OrderState[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/config/order-states', {
      context: toRestContext(ctx),
    })
    return raw.map(mapOrderState)
  }

  @Mutation(() => Category)
  @Roles(ROLES.superAdmin)
  async createCategory(
    @Args('input') input: CategoryInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Category> {
    const raw = await this.rest.post<RawRecord>('/v1/catalog/categories', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapCategory(raw)
  }

  @Mutation(() => Category)
  @Roles(ROLES.superAdmin)
  async updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CategoryInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Category> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/categories/${id}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapCategory(raw)
  }

  @Mutation(() => Category)
  @Roles(ROLES.superAdmin)
  async setCategoryActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('active') active: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Category> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/categories/${id}/active`, {
      body: { active },
      context: toRestContext(ctx),
    })
    return mapCategory(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async createProduct(
    @Args('input') input: ProductInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.post<RawRecord>('/v1/catalog/products', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ProductInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/products/${id}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async setProductAvailable(
    @Args('id', { type: () => ID }) id: string,
    @Args('available') available: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/products/${id}/available`, {
      body: { available },
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Mutation(() => ConfigGroup)
  @Roles(ROLES.superAdmin)
  async createConfigGroup(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('input') input: ConfigGroupInput,
    @Context() ctx: GraphQLContext,
  ): Promise<ConfigGroup> {
    const raw = await this.rest.post<RawRecord>(
      `/v1/catalog/products/${productId}/configurations`,
      {
        body: input,
        context: toRestContext(ctx),
      },
    )
    return mapConfigGroup(raw)
  }

  @Mutation(() => ConfigGroup)
  @Roles(ROLES.superAdmin)
  async updateConfigGroup(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('input') input: ConfigGroupInput,
    @Context() ctx: GraphQLContext,
  ): Promise<ConfigGroup> {
    const raw = await this.rest.patch<RawRecord>(
      `/v1/catalog/products/${productId}/configurations/${groupId}`,
      { body: input, context: toRestContext(ctx) },
    )
    return mapConfigGroup(raw)
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.superAdmin)
  async deleteConfigGroup(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<boolean> {
    await this.rest.delete(`/v1/catalog/products/${productId}/configurations/${groupId}`, {
      context: toRestContext(ctx),
    })
    return true
  }

  @Mutation(() => ConfigOption)
  @Roles(ROLES.superAdmin)
  async createConfigOption(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('input') input: ConfigOptionInput,
    @Context() ctx: GraphQLContext,
  ): Promise<ConfigOption> {
    const raw = await this.rest.post<RawRecord>(
      `/v1/catalog/products/${productId}/configurations/${groupId}/options`,
      { body: input, context: toRestContext(ctx) },
    )
    return mapConfigOption(raw)
  }

  @Mutation(() => ConfigOption)
  @Roles(ROLES.superAdmin)
  async updateConfigOption(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('optionId', { type: () => ID }) optionId: string,
    @Args('input') input: ConfigOptionInput,
    @Context() ctx: GraphQLContext,
  ): Promise<ConfigOption> {
    const raw = await this.rest.patch<RawRecord>(
      `/v1/catalog/products/${productId}/configurations/${groupId}/options/${optionId}`,
      { body: input, context: toRestContext(ctx) },
    )
    return mapConfigOption(raw)
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.superAdmin)
  async deleteConfigOption(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
    @Args('optionId', { type: () => ID }) optionId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<boolean> {
    await this.rest.delete(
      `/v1/catalog/products/${productId}/configurations/${groupId}/options/${optionId}`,
      { context: toRestContext(ctx) },
    )
    return true
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async setProductRecipe(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('items', { type: () => [RecipeItemInput] }) items: RecipeItemInput[],
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.put<RawRecord>(`/v1/catalog/products/${productId}/recipe`, {
      body: { items },
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async addRecipeItem(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('input') input: RecipeItemInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.post<RawRecord>(`/v1/catalog/products/${productId}/recipe/items`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapProduct(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async updateRecipeItem(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('itemId', { type: () => ID }) itemId: string,
    @Args('input') input: RecipeItemInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.patch<RawRecord>(
      `/v1/catalog/products/${productId}/recipe/items/${itemId}`,
      { body: input, context: toRestContext(ctx) },
    )
    return mapProduct(raw)
  }

  @Mutation(() => Product)
  @Roles(ROLES.superAdmin)
  async removeRecipeItem(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('itemId', { type: () => ID }) itemId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Product> {
    const raw = await this.rest.delete<RawRecord>(
      `/v1/catalog/products/${productId}/recipe/items/${itemId}`,
      { context: toRestContext(ctx) },
    )
    return mapProduct(raw)
  }

  @Mutation(() => Ingredient)
  @Roles(ROLES.superAdmin)
  async createIngredient(
    @Args('input') input: IngredientInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient> {
    const raw = await this.rest.post<RawRecord>('/v1/catalog/ingredients', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapIngredient(raw)
  }

  @Mutation(() => Ingredient)
  @Roles(ROLES.superAdmin)
  async updateIngredient(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: IngredientInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/ingredients/${id}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapIngredient(raw)
  }

  @Mutation(() => Ingredient)
  @Roles(ROLES.superAdmin)
  async setIngredientActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('active') active: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Ingredient> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/ingredients/${id}/active`, {
      body: { active },
      context: toRestContext(ctx),
    })
    return mapIngredient(raw)
  }

  @Mutation(() => Promotion)
  @Roles(ROLES.superAdmin)
  async createPromotion(
    @Args('input') input: PromotionInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Promotion> {
    const raw = await this.rest.post<RawRecord>('/v1/catalog/promotions', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapPromotion(raw)
  }

  @Mutation(() => Promotion)
  @Roles(ROLES.superAdmin)
  async updatePromotion(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: PromotionInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Promotion> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/promotions/${id}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapPromotion(raw)
  }

  @Mutation(() => Promotion)
  @Roles(ROLES.superAdmin)
  async setPromotionActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('active') active: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Promotion> {
    const raw = await this.rest.patch<RawRecord>(`/v1/catalog/promotions/${id}/active`, {
      body: { active },
      context: toRestContext(ctx),
    })
    return mapPromotion(raw)
  }

  @Mutation(() => Branch)
  @Roles(ROLES.superAdmin)
  async createBranch(
    @Args('input') input: BranchInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch> {
    const raw = await this.rest.post<RawRecord>('/v1/branches', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapBranch(raw)
  }

  @Mutation(() => Branch)
  @Roles(ROLES.superAdmin)
  async updateBranch(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: BranchInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch> {
    const raw = await this.rest.patch<RawRecord>(`/v1/branches/${id}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapBranch(raw)
  }

  @Mutation(() => Branch)
  @Roles(ROLES.superAdmin)
  async setBranchActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('active') active: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch> {
    const raw = await this.rest.patch<RawRecord>(`/v1/branches/${id}/active`, {
      body: { active },
      context: toRestContext(ctx),
    })
    return mapBranch(raw)
  }

  @Mutation(() => [BranchHours])
  @Roles(ROLES.superAdmin)
  async updateBranchHours(
    @Args('branchId', { type: () => ID }) branchId: string,
    @Args('hours', { type: () => [BranchHoursInput] }) hours: BranchHoursInput[],
    @Context() ctx: GraphQLContext,
  ): Promise<BranchHours[]> {
    const raw = await this.rest.put<RawRecord[]>(`/v1/branches/${branchId}/hours`, {
      body: { hours },
      context: toRestContext(ctx),
    })
    return raw.map(mapBranchHour)
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async setBranchProductAvailability(
    @Args('branchId', { type: () => ID }) branchId: string,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('available') available: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<boolean> {
    await this.rest.patch(`/v1/branches/${branchId}/products/${productId}/availability`, {
      body: { available },
      context: toRestContext(ctx),
    })
    return true
  }

  @Mutation(() => Cart)
  @Roles(ROLES.customer)
  async addCartItem(
    @Args('input') input: AddCartItemInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Cart> {
    const raw = await this.rest.post<RawRecord>('/v1/carts/items', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapCart(raw)
  }

  @Mutation(() => Cart)
  @Roles(ROLES.customer)
  async updateCartItem(
    @Args('itemId', { type: () => ID }) itemId: string,
    @Args('input') input: UpdateCartItemInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Cart> {
    const raw = await this.rest.patch<RawRecord>(`/v1/carts/items/${itemId}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapCart(raw)
  }

  @Mutation(() => Cart)
  @Roles(ROLES.customer)
  async removeCartItem(
    @Args('itemId', { type: () => ID }) itemId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Cart> {
    const raw = await this.rest.delete<RawRecord>(`/v1/carts/items/${itemId}`, {
      context: toRestContext(ctx),
    })
    return mapCart(raw)
  }

  @Mutation(() => Order)
  @Roles(ROLES.customer)
  async createOrder(
    @Args('addressId', { type: () => ID }) addressId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Order> {
    const address = await this.authRest.get<RawRecord>(`/v1/addresses/${addressId}`, {
      context: toRestContext(ctx),
    })
    const raw = await this.rest.post<RawRecord>('/v1/orders', {
      body: {
        addressId,
        deliveryAddress: {
          text: address.text,
          latitude: address.latitude,
          longitude: address.longitude,
        },
      },
      context: toRestContext(ctx),
    })
    return mapOrder(raw)
  }

  @Mutation(() => Order)
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async changeOrderStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('status', { type: () => OrderStatus }) status: OrderStatus,
    @Context() ctx: GraphQLContext,
  ): Promise<Order> {
    const raw = await this.rest.patch<RawRecord>(`/v1/orders/${orderId}/status`, {
      body: { status: orderStatusToRest(status) },
      context: toRestContext(ctx),
    })
    return mapOrder(raw)
  }

  @Mutation(() => RepeatOrderResult)
  @Roles(ROLES.customer)
  async repeatOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<RepeatOrderResult> {
    const raw = await this.rest.post<RawRecord>(`/v1/orders/${orderId}/repeat`, {
      context: toRestContext(ctx),
    })
    return {
      cart: mapCart(raw.cart as RawRecord),
      skippedProducts: (raw.skippedProducts as RawRecord[]).map(mapProduct),
    }
  }

  @Mutation(() => BranchStock)
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async adjustStock(
    @Args('input') input: AdjustStockInput,
    @Context() ctx: GraphQLContext,
  ): Promise<BranchStock> {
    const raw = await this.rest.post<RawRecord>('/v1/stock/adjustments', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapBranchStock(raw)
  }

  @Mutation(() => Parameter)
  @Roles(ROLES.superAdmin)
  async updateParameter(
    @Args('key') key: string,
    @Args('value') value: number,
    @Context() ctx: GraphQLContext,
  ): Promise<Parameter> {
    const raw = await this.rest.patch<RawRecord>(`/v1/config/parameters/${key}`, {
      body: { value },
      context: toRestContext(ctx),
    })
    return mapParameter(raw)
  }

  @Mutation(() => OrderState)
  @Roles(ROLES.superAdmin)
  async createOrderState(
    @Args('input') input: OrderStateInput,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderState> {
    const raw = await this.rest.post<RawRecord>('/v1/config/order-states', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapOrderState(raw)
  }

  @Mutation(() => OrderState)
  @Roles(ROLES.superAdmin)
  async updateOrderState(
    @Args('code') code: string,
    @Args('input') input: OrderStateInput,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderState> {
    const raw = await this.rest.put<RawRecord>(`/v1/config/order-states/${code}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapOrderState(raw)
  }

  @Mutation(() => OrderState)
  @Roles(ROLES.superAdmin)
  async setOrderStateActive(
    @Args('code') code: string,
    @Args('active') active: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderState> {
    const raw = await this.rest.patch<RawRecord>(`/v1/config/order-states/${code}/active`, {
      body: { active },
      context: toRestContext(ctx),
    })
    return mapOrderState(raw)
  }

  private async listOrders(
    ctx: GraphQLContext,
    filter: OrderFilterInput | null,
    page: PageInput | null,
  ): Promise<Order[]> {
    const raw = await this.rest.get<ListRest>('/v1/orders', {
      context: toRestContext(ctx),
      query: {
        status: filter?.status ? orderStatusToRest(filter.status) : undefined,
        branchId: filter?.branchId ?? undefined,
        search: filter?.search ?? undefined,
        limit: page?.limit,
        offset: page?.offset,
      },
    })
    return raw.data.map(mapOrder)
  }
}
