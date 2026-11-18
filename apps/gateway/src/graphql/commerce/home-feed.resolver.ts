import { Inject, UseGuards } from '@nestjs/common'
import { Args, Context, Query, Resolver } from '@nestjs/graphql'
import type { GraphQLContext } from '../../gateway/gateway.context'
import type { RestClient, RestQuery } from '../../rest/rest.client'
import { AUTH_REST_CLIENT, COMMERCE_REST_CLIENT } from '../../rest/rest.module'
import { AuthGuard } from '../../security/auth.guard'
import type { RawRecord } from '../common/mappers'
import { nullableNumber } from '../common/mappers'
import { toRestContext } from '../common/rest-context'
import { HomeFeedInput } from './home-feed.inputs'
import { mapHomeFeed } from './home-feed.mapper'
import { HomeFeed } from './home-feed.types'

const HOME_FEED_TIMEOUT_MS = 3000

const LIMITS = {
  forYou: { fallback: 8, max: 12 },
  discovery: { fallback: 4, max: 8 },
  reorder: { fallback: 3, max: 5 },
} as const

const clampLimit = (value: number | undefined, fallback: number, max: number): number => {
  if (value === undefined) return fallback
  return Math.min(Math.max(Math.trunc(value), 1), max)
}

@Resolver()
@UseGuards(AuthGuard)
export class HomeFeedResolver {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly rest: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly authRest: RestClient,
  ) {}

  /**
   * Home pública según la especificación (T-05). Si el request trae JWT, las
   * secciones personales se completan; si no, el backend devuelve el catálogo
   * y las promociones con `hasHistory=false`.
   */
  @Query(() => HomeFeed)
  async homeFeed(
    @Args('input', { type: () => HomeFeedInput, nullable: true })
    input: HomeFeedInput | null,
    @Context() ctx: GraphQLContext,
  ): Promise<HomeFeed> {
    const context = toRestContext(ctx)
    let latitude = input?.lat ?? null
    let longitude = input?.lng ?? null

    if (input?.addressId) {
      const address = await this.authRest.get<RawRecord>(`/v1/addresses/${input.addressId}`, {
        context,
      })
      const addressLatitude = nullableNumber(address.latitude)
      const addressLongitude = nullableNumber(address.longitude)
      if (addressLatitude !== null && addressLongitude !== null) {
        latitude = addressLatitude
        longitude = addressLongitude
      }
    }

    const query: RestQuery = {
      forYouLimit: clampLimit(input?.forYouLimit, LIMITS.forYou.fallback, LIMITS.forYou.max),
      discoveryLimit: clampLimit(
        input?.discoveryLimit,
        LIMITS.discovery.fallback,
        LIMITS.discovery.max,
      ),
      reorderLimit: clampLimit(input?.reorderLimit, LIMITS.reorder.fallback, LIMITS.reorder.max),
    }

    if (latitude !== null) query.lat = latitude
    if (longitude !== null) query.lng = longitude

    const raw = await this.rest.get<RawRecord>('/v1/personalization/home-feed', {
      context,
      query,
      timeoutMs: HOME_FEED_TIMEOUT_MS,
    })

    return mapHomeFeed(raw)
  }
}
