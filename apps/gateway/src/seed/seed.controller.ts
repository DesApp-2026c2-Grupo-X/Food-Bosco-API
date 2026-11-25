import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from '@nestjs/common'
import { env } from '../config/env'
import { RestClient } from '../rest/rest.client'
import { InternalGuard } from '../security/internal.guard'
import { AUTH_REST_CLIENT, COMMERCE_REST_CLIENT, DELIVERY_REST_CLIENT } from '../rest/rest.module'

type Raw = Record<string, unknown>

interface SeedBranch {
  id: string
  name: string
  latitude?: number
  longitude?: number
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

interface SeedDeliveredOrder {
  orderId: string
  branchId: string
  riderId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
  createdAt: string
  pickedUpAt: string | null
  deliveredAt: string
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
  deliveredOrders?: SeedDeliveredOrder[]
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
const MAX_READY_ORDERS = 12
const DEFAULT_DEMO_CLIENTS = 40

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
    const clients = demoEnabled
      ? (readInt('clients', body.clients, 1, 500) ?? DEFAULT_DEMO_CLIENTS)
      : undefined
    const demo = demoEnabled ? this.readDemoOptions(body) : undefined

    const commerceResult = await this.commerce.post<CommerceSeedResult>('/v1/seed', {
      context,
      errorsAsHttp: true,
    })

    const authResult = await this.auth.post<AuthSeedResult>('/v1/seed', {
      context,
      body: {
        branches: commerceResult.branches.map(({ id, name }) => ({ id, name })),
        demoCustomers: demoEnabled,
        ...(clients !== undefined ? { demoCustomerCount: clients } : {}),
      },
      errorsAsHttp: true,
    })

    const ordersResult = await this.seedOrders(context, authResult, demo)

    const deliverySummary = await this.seedDelivery(
      context,
      authResult,
      commerceResult.branches,
      ordersResult,
      Boolean(demo?.reset),
    )

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

    const riderIds = authResult.users.filter((user) => user.role === 'rider').map((user) => user.id)

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
        ...(riderIds.length > 0 ? { riderIds } : {}),
        demo,
      },
      errorsAsHttp: true,
    })
  }

  private async seedDelivery(
    context: RestContext,
    authResult: AuthSeedResult,
    branches: SeedBranch[],
    ordersResult: CommerceSeedResult,
    resetDemoTrips: boolean,
  ): Promise<Raw> {
    const riders = authResult.users.filter((user) => user.role === 'rider')
    if (riders.length === 0) return { riders: 0, completedTrips: 0 }

    const readyOrders = (ordersResult.orders ?? [])
      .filter((order) => order.status === 'ready_for_delivery')
      .slice(0, MAX_READY_ORDERS)
      .map((order) => ({
        orderId: order.id,
        branchId: order.branchId,
        branchLocation: order.branchLocation,
        deliveryAddress: order.deliveryAddress,
      }))

    const deliveredByRider = new Map<string, Omit<SeedDeliveredOrder, 'riderId'>[]>()
    for (const order of ordersResult.deliveredOrders ?? []) {
      const list = deliveredByRider.get(order.riderId) ?? []
      list.push({
        orderId: order.orderId,
        branchId: order.branchId,
        branchLocation: order.branchLocation,
        deliveryAddress: order.deliveryAddress,
        createdAt: order.createdAt,
        pickedUpAt: order.pickedUpAt,
        deliveredAt: order.deliveredAt,
      })
      deliveredByRider.set(order.riderId, list)
    }

    const demoBatchId = ordersResult.demo?.batchId ?? undefined
    let primarySummary: Raw = { riders: 0 }
    let totalCompletedTrips = 0

    for (const [index, rider] of riders.entries()) {
      const isPrimary = index === 0
      const location = this.resolveRiderLocation(rider, index, branches, readyOrders)
      const completedOrders = deliveredByRider.get(rider.id) ?? []

      const deliveryResult = await this.delivery.post<{ summary: Raw }>('/v1/seed', {
        context,
        body: {
          userId: rider.id,
          firstName: rider.firstName,
          lastName: rider.lastName,
          phone: rider.phone,
          vehicle: rider.vehicle,
          available: true,
          ...(location ? { location } : {}),
          readyOrders: isPrimary ? readyOrders : [],
          ...(completedOrders.length > 0 ? { completedOrders } : {}),
          ...(demoBatchId ? { demoBatchId } : {}),
          ...(isPrimary && resetDemoTrips ? { resetDemoTrips: true } : {}),
        },
        errorsAsHttp: true,
      })

      const tripsCount = deliveryResult.summary?.completedTrips
      if (typeof tripsCount === 'number') {
        totalCompletedTrips += tripsCount
      }

      if (isPrimary) {
        primarySummary = deliveryResult.summary
      }
    }

    return {
      ...primarySummary,
      riders: riders.length,
      completedTrips: totalCompletedTrips,
    }
  }

  private resolveRiderLocation(
    rider: SeedUser,
    index: number,
    branches: SeedBranch[],
    readyOrders: { branchLocation: { latitude: number; longitude: number } }[],
  ): { latitude: number; longitude: number } | undefined {
    if (index === 0 && readyOrders[0]?.branchLocation) {
      return readyOrders[0].branchLocation
    }

    const locatedBranches = branches.filter(
      (branch): branch is SeedBranch & { latitude: number; longitude: number } =>
        typeof branch.latitude === 'number' && typeof branch.longitude === 'number',
    )
    if (locatedBranches.length === 0) return undefined

    const email = rider.email.toLowerCase()
    const matched =
      (email.includes('unahur') &&
        locatedBranches.find((b) => b.name.toLowerCase() === 'unahur')) ||
      (email.includes('norte') && locatedBranches.find((b) => b.name.toLowerCase() === 'norte')) ||
      (email.includes('oeste') && locatedBranches.find((b) => b.name.toLowerCase() === 'oeste')) ||
      locatedBranches[index % locatedBranches.length]

    const offset = index === 0 ? 0 : index * 0.0005
    return {
      latitude: matched.latitude + offset,
      longitude: matched.longitude - offset,
    }
  }
}
