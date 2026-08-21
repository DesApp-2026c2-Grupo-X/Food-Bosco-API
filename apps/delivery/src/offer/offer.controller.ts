import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicTrip } from '../trip/trip.model'
import { TripService } from '../trip/trip.service'
import type { TripListResponse } from '../trip/trip.service'
import { TripQueryDto } from './dto/trip-query.dto'
import { OfferOrchestrator } from './offer.orchestrator'
import type { OfferListResponse } from './offer.orchestrator'

@Controller('v1/trips')
@Roles(ROLES.rider)
export class OfferController {
  constructor(
    private readonly orchestrator: OfferOrchestrator,
    private readonly tripService: TripService,
  ) {}

  @Get('offers')
  listOffers(@CurrentUser() auth: AuthContext): Promise<OfferListResponse> {
    return this.orchestrator.listOffers(auth.userId ?? '')
  }

  @Post('offers/:offerId/accept')
  accept(@CurrentUser() auth: AuthContext, @Param('offerId') offerId: string): Promise<PublicTrip> {
    return this.orchestrator.acceptOffer(auth.userId ?? '', offerId)
  }

  @Post('offers/:offerId/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() auth: AuthContext,
    @Param('offerId') offerId: string,
  ): Promise<{ ok: boolean }> {
    await this.orchestrator.rejectOffer(auth.userId ?? '', offerId)
    return { ok: true }
  }

  @Post(':tripId/orders/:orderId/pickup')
  pickup(
    @CurrentUser() auth: AuthContext,
    @Param('tripId') tripId: string,
    @Param('orderId') orderId: string,
  ): Promise<PublicTrip> {
    return this.orchestrator.markPickup(auth.userId ?? '', tripId, orderId)
  }

  @Post(':tripId/orders/:orderId/deliver')
  deliver(
    @CurrentUser() auth: AuthContext,
    @Param('tripId') tripId: string,
    @Param('orderId') orderId: string,
  ): Promise<PublicTrip> {
    return this.orchestrator.markDeliver(auth.userId ?? '', tripId, orderId)
  }

  @Get()
  list(@CurrentUser() auth: AuthContext, @Query() query: TripQueryDto): Promise<TripListResponse> {
    return this.tripService.listByRider(auth.userId ?? '', query.limit ?? 20, query.offset ?? 0)
  }

  @Get(':tripId')
  async get(
    @CurrentUser() auth: AuthContext,
    @Param('tripId') tripId: string,
  ): Promise<PublicTrip> {
    const trip = await this.tripService.findByIdForRider(tripId, auth.userId ?? '')
    if (!trip) {
      throw new DomainException(ERROR_CODES.tripNotFound, 'Viaje no encontrado', 404)
    }
    return trip
  }
}
