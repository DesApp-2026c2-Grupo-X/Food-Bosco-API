import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ROLES } from '../config/constants'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicRider } from './rider.model'
import { RiderOrchestrator } from './rider.orchestrator'
import { AvailabilityDto } from './dto/availability.dto'
import { LocationDto } from './dto/location.dto'
import { UpdateRiderProfileDto } from './dto/update-rider-profile.dto'

@Controller('v1/riders/me')
@Roles(ROLES.rider)
export class RiderController {
  constructor(private readonly orchestrator: RiderOrchestrator) {}

  @Get()
  get(@CurrentUser() auth: AuthContext): Promise<PublicRider> {
    return this.orchestrator.getProfile(auth.userId ?? '')
  }

  @Patch()
  update(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdateRiderProfileDto,
  ): Promise<PublicRider> {
    return this.orchestrator.updateProfile(auth.userId ?? '', dto)
  }

  @Patch('availability')
  setAvailability(
    @CurrentUser() auth: AuthContext,
    @Body() dto: AvailabilityDto,
  ): Promise<PublicRider> {
    return this.orchestrator.setAvailability(auth.userId ?? '', dto.online)
  }

  @Patch('location')
  updateLocation(@CurrentUser() auth: AuthContext, @Body() dto: LocationDto): Promise<PublicRider> {
    return this.orchestrator.updateLocation(auth.userId ?? '', dto.lat, dto.lng)
  }
}
