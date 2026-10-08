import { Controller, Inject, Post, UseGuards } from '@nestjs/common'

import { env } from '../config/env'

import { RestClient } from '../rest/rest.client'

import { InternalGuard } from '../security/internal.guard'

import { AUTH_REST_CLIENT, COMMERCE_REST_CLIENT, DELIVERY_REST_CLIENT } from '../rest/rest.module'

type Raw = Record<string, unknown>

interface SeedBranch {
  id: string
  name: string
}

interface SeedUser {
  id: string
  email: string
  role: string
  firstName: string
  lastName: string
  phone: string
  vehicle: string | null
}

interface SeedAddress {
  userId: string
  id: string
  label: string
  text: string
  latitude: number
  longitude: number
}

interface SeedOrder {
  id: string
  number: string
  status: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

interface CommerceSeedResult {
  summary: Raw
  branches: SeedBranch[]
  orders?: SeedOrder[]
}

interface AuthSeedResult {
  summary: Raw
  users: SeedUser[]
  addresses?: SeedAddress[]
}

interface RestContext {
  internalToken: string
}

@Controller('seed')
@UseGuards(InternalGuard)
export class SeedController {
  constructor(
    @Inject(COMMERCE_REST_CLIENT)
    private readonly commerce: RestClient,

    @Inject(AUTH_REST_CLIENT)
    private readonly auth: RestClient,

    @Inject(DELIVERY_REST_CLIENT)
    private readonly delivery: RestClient,
  ) {}

  @Post()
  async seed(): Promise<{
    commerce: Raw
    auth: Raw
    delivery: Raw
  }> {
    const context: RestContext = { internalToken: env.internalApiToken }

    const commerceResult = await this.commerce.post<CommerceSeedResult>('/v1/seed', {
      context,
      errorsAsHttp: true,
    })

    const authResult = await this.auth.post<AuthSeedResult>('/v1/seed', {
      context,
      body: { branches: commerceResult.branches },
      errorsAsHttp: true,
    })

    const ordersResult = await this.seedOrders(context, authResult)
    const deliverySummary = await this.seedDelivery(context, authResult, ordersResult)

    return {
      commerce: commerceResult.summary,
      auth: authResult.summary,
      delivery: deliverySummary,
    }
  }

  private async seedOrders(
    context: RestContext,
    authResult: AuthSeedResult,
  ): Promise<CommerceSeedResult> {
    const customer = authResult.users.find((user) => user.role === 'customer')
    const address = authResult.addresses?.find((entry) => entry.userId === customer?.id)

    if (!customer || !address) {
      return { summary: { orders: 0 }, branches: [], orders: [] }
    }

    return this.commerce.post<CommerceSeedResult>('/v1/seed', {
      context,
      body: {
        order: {
          clientId: customer.id,
          address: {
            id: address.id,
            text: address.text,
            latitude: address.latitude,
            longitude: address.longitude,
          },
        },
      },
      errorsAsHttp: true,
    })
  }

  private async seedDelivery(
    context: RestContext,
    authResult: AuthSeedResult,
    ordersResult: CommerceSeedResult,
  ): Promise<Raw> {
    const rider = authResult.users.find((user) => user.role === 'rider')
    if (!rider) return { riders: 0 }

    const readyOrder = ordersResult.orders?.find((order) => order.status === 'ready_for_delivery')

    const deliveryResult = await this.delivery.post<{ summary: Raw }>('/v1/seed', {
      context,
      body: {
        userId: rider.id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        phone: rider.phone,
        vehicle: rider.vehicle,
        available: true,
        location: readyOrder?.branchLocation,
        readyOrder: readyOrder
          ? {
              orderId: readyOrder.id,
              branchId: readyOrder.branchId,
              branchLocation: readyOrder.branchLocation,
              deliveryAddress: readyOrder.deliveryAddress,
            }
          : undefined,
      },
      errorsAsHttp: true,
    })

    return deliveryResult.summary
  }
}
