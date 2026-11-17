import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { GraphQLError } from 'graphql'
import { ROLES } from '../../config/constants'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import {
  AUTH_REST_CLIENT,
  COMMERCE_REST_CLIENT,
  DELIVERY_REST_CLIENT,
} from '../../rest/rest.module'
import { AuthGuard } from '../../security/auth.guard'
import { Roles } from '../../security/roles.decorator'
import { toRestContext } from '../common/rest-context'
import { Branch, Order, mapBranch, mapOrder } from './commerce.types'
import { CreateOrderReviewInput, ReviewFilterInput } from './reviews.inputs'
import {
  BranchRatingRow,
  BranchReviewStats,
  CourierRatingRow,
  CourierReviewStats,
  OrderReview,
  OrderReviewStatus,
  ReviewsSummary,
  mapBranchRatingRow,
  mapBranchReviewStats,
  mapCourierRatingRow,
  mapCourierReviewStats,
  mapOrderReview,
  mapOrderReviewStatus,
  mapReviewsSummary,
} from './reviews.types'
import { getCommerceLoaders, getRiderLoader } from './commerce.dataloaders'
import { Rider, mapRider } from '../delivery/delivery.types'

type RawRecord = Record<string, unknown>

const forbidden = (message: string): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'FORBIDDEN', httpStatus: 403 } })

const badRequest = (message: string): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'BAD_REQUEST', httpStatus: 400 } })

const reviewQuery = (
  filter: ReviewFilterInput | null,
): Record<string, string | number | undefined> => ({
  from: filter?.from ?? undefined,
  to: filter?.to ?? undefined,
  limit: filter?.limit ?? undefined,
})

@Resolver()
@UseGuards(AuthGuard)
export class ReviewsResolver {
  constructor(@Inject(COMMERCE_REST_CLIENT) private readonly rest: RestClient) {}

  @Mutation(() => OrderReview)
  @Roles(ROLES.customer)
  async createOrderReview(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('input') input: CreateOrderReviewInput,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderReview> {
    const raw = await this.rest.post<RawRecord>(`/v1/reviews/orders/${orderId}`, {
      body: input,
      context: toRestContext(ctx),
    })
    return mapOrderReview(raw)
  }

  @Query(() => [OrderReview])
  @Roles(ROLES.customer)
  async myOrderReviews(@Context() ctx: GraphQLContext): Promise<OrderReview[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reviews/mine', {
      context: toRestContext(ctx),
    })
    return raw.map(mapOrderReview)
  }

  @Query(() => [Order])
  @Roles(ROLES.customer)
  async pendingOrderReviews(@Context() ctx: GraphQLContext): Promise<Order[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reviews/pending', {
      context: toRestContext(ctx),
    })
    return raw.map(mapOrder)
  }

  @Query(() => OrderReviewStatus)
  @Roles(ROLES.customer)
  async orderReviewStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<OrderReviewStatus> {
    const raw = await this.rest.get<RawRecord>(`/v1/reviews/orders/${orderId}`, {
      context: toRestContext(ctx),
    })
    return mapOrderReviewStatus(raw)
  }

  @Query(() => BranchReviewStats)
  @Roles(ROLES.branchAdmin, ROLES.superAdmin)
  async branchReviewStats(
    @Args('branchId', { type: () => ID, nullable: true }) branchId: string | null,
    @Args('filter', { type: () => ReviewFilterInput, nullable: true })
    filter: ReviewFilterInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<BranchReviewStats> {
    const resolved = this.resolveBranchId(ctx, branchId)
    const raw = await this.rest.get<RawRecord>(`/v1/reviews/branches/${resolved}/stats`, {
      context: toRestContext(ctx),
      query: reviewQuery(filter),
    })
    return mapBranchReviewStats(raw)
  }

  @Query(() => CourierReviewStats)
  @Roles(ROLES.rider, ROLES.superAdmin)
  async courierReviewStats(
    @Args('courierId', { type: () => ID, nullable: true }) courierId: string | null,
    @Args('filter', { type: () => ReviewFilterInput, nullable: true })
    filter: ReviewFilterInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<CourierReviewStats> {
    const resolved = this.resolveCourierId(ctx, courierId)
    const raw = await this.rest.get<RawRecord>(`/v1/reviews/couriers/${resolved}/stats`, {
      context: toRestContext(ctx),
      query: reviewQuery(filter),
    })
    return mapCourierReviewStats(raw)
  }

  @Query(() => [BranchRatingRow])
  @Roles(ROLES.superAdmin)
  async branchRatingRanking(
    @Args('filter', { type: () => ReviewFilterInput, nullable: true })
    filter: ReviewFilterInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<BranchRatingRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reviews/branches/ranking', {
      context: toRestContext(ctx),
      query: reviewQuery(filter),
    })
    return raw.map(mapBranchRatingRow)
  }

  @Query(() => [CourierRatingRow])
  @Roles(ROLES.superAdmin)
  async courierRatingRanking(
    @Args('filter', { type: () => ReviewFilterInput, nullable: true })
    filter: ReviewFilterInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<CourierRatingRow[]> {
    const raw = await this.rest.get<RawRecord[]>('/v1/reviews/couriers/ranking', {
      context: toRestContext(ctx),
      query: reviewQuery(filter),
    })
    return raw.map(mapCourierRatingRow)
  }

  @Query(() => ReviewsSummary)
  @Roles(ROLES.superAdmin)
  async reviewsSummary(
    @Args('filter', { type: () => ReviewFilterInput, nullable: true })
    filter: ReviewFilterInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<ReviewsSummary> {
    const raw = await this.rest.get<RawRecord>('/v1/reviews/summary', {
      context: toRestContext(ctx),
      query: reviewQuery(filter),
    })
    return mapReviewsSummary(raw)
  }

  private resolveBranchId(ctx: GraphQLContext, branchId: string | null): string {
    if (ctx.roles.includes(ROLES.superAdmin)) {
      if (!branchId) throw badRequest('Tenés que indicar la sucursal.')
      return branchId
    }
    if (!ctx.branchId) throw forbidden('Sin sucursal asignada.')
    return ctx.branchId
  }

  private resolveCourierId(ctx: GraphQLContext, courierId: string | null): string {
    if (ctx.roles.includes(ROLES.superAdmin)) {
      if (!courierId) throw badRequest('Tenés que indicar el repartidor.')
      return courierId
    }
    if (!ctx.userId) throw forbidden('Identidad no resoluble.')
    return ctx.userId
  }
}

@Resolver(() => OrderReview)
export class OrderReviewFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('branch', () => Branch, { nullable: true })
  async branch(
    @Parent() review: OrderReview,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch | null> {
    const raw = await getCommerceLoaders(
      ctx.req,
      this.commerce,
      this.auth,
      toRestContext(ctx),
    ).branch.load(review.branchId)
    return raw ? mapBranch(raw) : null
  }
}

@Resolver(() => BranchRatingRow)
export class BranchRatingRowFieldResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
  ) {}

  @ResolveField('branch', () => Branch, { nullable: true })
  async branch(
    @Parent() row: BranchRatingRow,
    @Context() ctx: GraphQLContext,
  ): Promise<Branch | null> {
    const raw = await getCommerceLoaders(
      ctx.req,
      this.commerce,
      this.auth,
      toRestContext(ctx),
    ).branch.load(row.branchId)
    return raw ? mapBranch(raw) : null
  }
}

@Resolver(() => CourierRatingRow)
export class CourierRatingRowFieldResolver {
  constructor(@Inject(DELIVERY_REST_CLIENT) private readonly delivery: RestClient) {}

  @ResolveField('rider', () => Rider, { nullable: true })
  async rider(
    @Parent() row: CourierRatingRow,
    @Context() ctx?: GraphQLContext,
  ): Promise<Rider | null> {
    const raw = await getRiderLoader(ctx?.req, this.delivery).load(row.courierId)
    return raw ? mapRider(raw) : null
  }
}
