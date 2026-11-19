import { Controller, Get, Query } from '@nestjs/common'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { HomeFeedQueryDto } from './dto/home-feed-query.dto'
import type { HomeFeed } from './personalization.model'
import { PersonalizationOrchestrator } from './personalization.orchestrator'

@Controller('v1/personalization')
export class PersonalizationController {
  constructor(private readonly orchestrator: PersonalizationOrchestrator) {}

  /**
   * Home pública según la especificación (T-05): si no hay JWT, responde el
   * catálogo y las promociones sin secciones personales.
   */
  @Get('home-feed')
  getHomeFeed(
    @CurrentUser() auth: AuthContext,
    @Query() query: HomeFeedQueryDto,
  ): Promise<HomeFeed> {
    return this.orchestrator.getHomeFeed(auth, query)
  }
}
