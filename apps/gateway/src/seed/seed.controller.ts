import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from '@nestjs/common'
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

interface SeedCustomer {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  addresses: SeedAddress[]
}

interface SeedOrder {
  id: string
  number: string
  status: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
}

interface SeedDemoSummary {
  enabled: boolean
  batchId: string | null
  seed: number | null
  orders: number
  customers: number
  resetDeleted: number
  outOfStockRows: number
}

interface CommerceSeedResult {
  summary: Raw
  branches: SeedBranch[]
  orders?: SeedOrder[]
  demo?: SeedDemoSummary
}

interface AuthSeedResult {
  summary: Raw
  users: SeedUser[]
  addresses?: SeedAddress[]
  customers?: SeedCustomer[]
}

interface RestContext {
  internalToken: string
}

interface SeedRequest {
  demo?: unknown
  orders?: unknown
  days?: unknown
  seed?: unknown
  reset?: unknown
  clients?: unknown
}

const MAX_DEMO_ORDERS = 2000
const MAX_DEMO_DAYS = 730
const MAX_READY_ORDERS = 5

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const readInt = (field: string, value: unknown, min: number, max: number): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined

  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${field} debe ser un entero entre ${min} y ${max}`)
  }

  return parsed
}

const emptyDemoSummary = (): SeedDemoSummary => ({
  enabled: false,
  batchId: null,
  seed: null,
  orders: 0,
  customers: 0,
  resetDeleted: 0,
  outOfStockRows: 0,
})

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
  async seed(
    @Body() body: SeedRequest = {},
  ): Promise<{ commerce: Raw; auth: Raw; demo: SeedDemoSummary; delivery: Raw }> {
    const context: RestContext = { internalToken: env.internalApiToken }
    const demoEnabled = readBoolean(body.demo) ?? env.seed.demo
    const clients = demoEnabled ? readInt('clients', body.clients, 1, 500) : undefined
    const demo = demoEnabled ? this.readDemoOptions(body) : undefined

    const commerceResult = await this.commerce.post<CommerceSeedResult>('/v1/seed', {
      context,
      errorsAsHttp: true,
    })

    const authResult = await this.auth.post<AuthSeedResult>('/v1/seed', {
      context,
      body: {
        branches: commerceResult.branches,
        demoCustomers: demoEnabled,
        ...(clients !== undefined ? { demoCustomerCount: clients } : {}),
      },
      errorsAsHttp: true,
    })

    const ordersResult = await this.seedOrders(context, authResult, demo)

    const deliverySummary = await this.seedDelivery(context, authResult, ordersResult)

    return {
      commerce: commerceResult.summary,
      auth: authResult.summary,
      demo: ordersResult.demo ?? emptyDemoSummary(),
      delivery: deliverySummary,
    }
  }

  private readDemoOptions(body: SeedRequest): {
    orders?: number
    days?: number
    seed?: number
    reset?: boolean
  } {
    return {
      orders: readInt('orders', body.orders, 0, MAX_DEMO_ORDERS),
      days: readInt('days', body.days, 1, MAX_DEMO_DAYS),
      seed: readInt('seed', body.seed, 1, Number.MAX_SAFE_INTEGER),
      reset: readBoolean(body.reset),
    }
  }

  private async seedOrders(
    context: RestContext,
    authResult: AuthSeedResult,
    demo?: { orders?: number; days?: number; seed?: number; reset?: boolean },
  ): Promise<CommerceSeedResult> {
    if (!demo) return { summary: {}, branches: [], orders: [] }

    const customers = (authResult.customers ?? []).filter(
      (customer) => customer.addresses.length > 0,
    )
    if (customers.length === 0) return { summary: {}, branches: [], orders: [] }

    return this.commerce.post<CommerceSeedResult>('/v1/seed', {
      context,
      body: {
        customers: customers.map((customer) => ({
          id: customer.id,
          addresses: customer.addresses.map((address) => ({
            id: address.id,
            text: address.text,
            latitude: address.latitude,
            longitude: address.longitude,
          })),
        })),
        demo,
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

    const readyOrders = (ordersResult.orders ?? [])
      .filter((order) => order.status === 'ready_for_delivery')
      .slice(0, MAX_READY_ORDERS)
      .map((order) => ({
        orderId: order.id,
        branchId: order.branchId,
        branchLocation: order.branchLocation,
        deliveryAddress: order.deliveryAddress,
      }))

    const deliveryResult = await this.delivery.post<{ summary: Raw }>('/v1/seed', {
      context,
      body: {
        userId: rider.id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        phone: rider.phone,
        vehicle: rider.vehicle,
        available: true,
        location: readyOrders[0]?.branchLocation,
        readyOrders,
      },
      errorsAsHttp: true,
    })

    return deliveryResult.summary
  }
}
