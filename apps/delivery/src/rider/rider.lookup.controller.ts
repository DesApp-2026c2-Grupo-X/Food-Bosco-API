import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { Internal } from '../config/security/internal.decorator'
import type { PublicRider } from './rider.model'
import { RiderService } from './rider.service'

@Controller('v1/riders')
export class RiderLookupController {
  constructor(private readonly riderService: RiderService) {}

  @Get('by-user/:userId')
  @Internal()
  async byUserId(@Param('userId') userId: string): Promise<PublicRider> {
    const rider = await this.riderService.findByUserId(userId)
    if (!rider) {
      throw new NotFoundException('Repartidor no encontrado')
    }
    return rider
  }
}
