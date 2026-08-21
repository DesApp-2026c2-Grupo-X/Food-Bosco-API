import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { ROLES } from '../../config/constants'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient } from '../../rest/rest.client'
import { DELIVERY_REST_CLIENT } from '../../rest/rest.module'
import { AuthGuard } from '../../security/auth.guard'
import { Roles } from '../../security/roles.decorator'
import { PageInput } from '../common/page'
import { toRestContext } from '../common/rest-context'
import { UpdateRiderProfileInput } from './delivery.inputs'
import { Rider, Trip, TripOffer, mapRider, mapTrip, mapTripOffer } from './delivery.types'

type RawRecord = Record<string, unknown>

interface TripListRest {
  data: RawRecord[]
}

interface OfferListRest {
  data: RawRecord[]
}

@Resolver()
@UseGuards(AuthGuard)
export class DeliveryResolver {
  constructor(@Inject(DELIVERY_REST_CLIENT) private readonly rest: RestClient) {}

  @Query(() => Rider)
  @Roles(ROLES.rider)
  async riderProfile(@Context() ctx: GraphQLContext): Promise<Rider> {
    const raw = await this.rest.get<RawRecord>('/v1/riders/me', { context: toRestContext(ctx) })
    return mapRider(raw)
  }

  @Query(() => [TripOffer])
  @Roles(ROLES.rider)
  async tripOffers(@Context() ctx: GraphQLContext): Promise<TripOffer[]> {
    const raw = await this.rest.get<OfferListRest>('/v1/trips/offers', {
      context: toRestContext(ctx),
    })
    return raw.data.map(mapTripOffer)
  }

  @Query(() => Trip)
  @Roles(ROLES.rider)
  async trip(
    @Args('id', { type: () => ID }) id: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Trip> {
    const raw = await this.rest.get<RawRecord>(`/v1/trips/${id}`, {
      context: toRestContext(ctx),
    })
    return mapTrip(raw)
  }

  @Query(() => [Trip])
  @Roles(ROLES.rider)
  async myTrips(
    @Args('page', { type: () => PageInput, nullable: true }) page: PageInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<Trip[]> {
    const raw = await this.rest.get<TripListRest>('/v1/trips', {
      context: toRestContext(ctx),
      query: { limit: page?.limit, offset: page?.offset },
    })
    return raw.data.map(mapTrip)
  }

  @Mutation(() => Rider)
  @Roles(ROLES.rider)
  async updateRiderProfile(
    @Args('input') input: UpdateRiderProfileInput,
    @Context() ctx: GraphQLContext,
  ): Promise<Rider> {
    const raw = await this.rest.patch<RawRecord>('/v1/riders/me', {
      body: input,
      context: toRestContext(ctx),
    })
    return mapRider(raw)
  }

  @Mutation(() => Rider)
  @Roles(ROLES.rider)
  async setRiderAvailability(
    @Args('online') online: boolean,
    @Context() ctx: GraphQLContext,
  ): Promise<Rider> {
    const raw = await this.rest.patch<RawRecord>('/v1/riders/me/availability', {
      body: { online },
      context: toRestContext(ctx),
    })
    return mapRider(raw)
  }

  @Mutation(() => Rider)
  @Roles(ROLES.rider)
  async updateRiderLocation(
    @Args('lat') lat: number,
    @Args('lng') lng: number,
    @Context() ctx: GraphQLContext,
  ): Promise<Rider> {
    const raw = await this.rest.patch<RawRecord>('/v1/riders/me/location', {
      body: { lat, lng },
      context: toRestContext(ctx),
    })
    return mapRider(raw)
  }

  @Mutation(() => Trip)
  @Roles(ROLES.rider)
  async acceptTripOffer(
    @Args('offerId', { type: () => ID }) offerId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Trip> {
    const raw = await this.rest.post<RawRecord>(`/v1/trips/offers/${offerId}/accept`, {
      context: toRestContext(ctx),
    })
    return mapTrip(raw)
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.rider)
  async rejectTripOffer(
    @Args('offerId', { type: () => ID }) offerId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<boolean> {
    await this.rest.post(`/v1/trips/offers/${offerId}/reject`, { context: toRestContext(ctx) })
    return true
  }

  @Mutation(() => Trip)
  @Roles(ROLES.rider)
  async markOrderPickup(
    @Args('tripId', { type: () => ID }) tripId: string,
    @Args('orderId', { type: () => ID }) orderId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Trip> {
    const raw = await this.rest.post<RawRecord>(`/v1/trips/${tripId}/orders/${orderId}/pickup`, {
      context: toRestContext(ctx),
    })
    return mapTrip(raw)
  }

  @Mutation(() => Trip)
  @Roles(ROLES.rider)
  async markOrderDelivered(
    @Args('tripId', { type: () => ID }) tripId: string,
    @Args('orderId', { type: () => ID }) orderId: string,
    @Context() ctx: GraphQLContext,
  ): Promise<Trip> {
    const raw = await this.rest.post<RawRecord>(`/v1/trips/${tripId}/orders/${orderId}/deliver`, {
      context: toRestContext(ctx),
    })
    return mapTrip(raw)
  }
}
