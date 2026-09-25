import { Controller, Param, Post } from '@nestjs/common'
import { Internal } from '../config/security/internal.decorator'
import { OfferOrchestrator } from './offer.orchestrator'

@Controller('v1/internal/trips')
export class TripAdminController {
  constructor(private readonly orchestrator: OfferOrchestrator) {}

  @Post('orders/:orderId/release')
  @Internal()
  async release(@Param('orderId') orderId: string): Promise<{ ok: boolean }> {
    await this.orchestrator.releaseOrder(orderId)
    return { ok: true }
  }
}
