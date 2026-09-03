import { Controller, Inject, Post } from '@nestjs/common'
import { env } from '../config/env'
import { RestClient } from '../rest/rest.client'
import { AUTH_REST_CLIENT, COMMERCE_REST_CLIENT, DELIVERY_REST_CLIENT } from '../rest/rest.module'

type Raw = Record<string, unknown>

interface CommerceSeedResult {
  summary: Raw
  branches: { id: string; name: string }[]
}

interface AuthSeedResult {
  summary: Raw
  users: {
    id: string
    email: string
    role: string
    firstName: string
    lastName: string
    phone: string
    vehicle: string | null
  }[]
}

@Controller('seed')
export class SeedController {
  constructor(
    @Inject(COMMERCE_REST_CLIENT) private readonly commerce: RestClient,
    @Inject(AUTH_REST_CLIENT) private readonly auth: RestClient,
    @Inject(DELIVERY_REST_CLIENT) private readonly delivery: RestClient,
  ) {}

  @Post()
  async seed(): Promise<{ commerce: Raw; auth: Raw; delivery: Raw }> {
    const context = { internalToken: env.internalApiToken }

    const commerceResult = await this.commerce.post<CommerceSeedResult>('/v1/seed', { context })
    const branchId = commerceResult.branches[0]?.id

    const authResult = await this.auth.post<AuthSeedResult>('/v1/seed', {
      context,
      body: { branchId },
    })

    const rider = authResult.users.find((user) => user.role === 'rider')

    let deliverySummary: Raw = { riders: 0 }
    if (rider) {
      const deliveryResult = await this.delivery.post<{ summary: Raw }>('/v1/seed', {
        context,
        body: {
          userId: rider.id,
          firstName: rider.firstName,
          lastName: rider.lastName,
          phone: rider.phone,
          vehicle: rider.vehicle,
        },
      })
      deliverySummary = deliveryResult.summary
    }

    return {
      commerce: commerceResult.summary,
      auth: authResult.summary,
      delivery: deliverySummary,
    }
  }
}
