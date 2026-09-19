import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  gql,
  GraphQLBody,
  okResponse,
  queryParams,
  signToken,
} from './downstream'

const rawRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: { type: 'moto', brand: 'Honda', model: 'CG', plate: 'ABC123' },
  phone: '11223344',
  available: true,
  currentLocation: { latitude: -34.6, longitude: -58.4 },
}

const rawTripOffer = {
  id: 't1',
  orderCount: 2,
  distanceKm: 5.5,
  estimatedMinutes: 13,
  estimatedEarnings: 1200,
  expiresAt: '2026-01-01T00:01:00.000Z',
}

const rawTrip = {
  id: 't1',
  riderId: 'u1',
  status: 'active',
  orders: [
    {
      orderId: 'ord-1',
      pickupBranchId: 'b1',
      pickupLocation: { latitude: -34.6, longitude: -58.4 },
      deliveryAddress: { text: 'Av 123', latitude: -34.61, longitude: -58.41 },
      status: 'on_the_way',
      pickedUpAt: '2026-01-01T00:00:30.000Z',
      deliveredAt: null,
    },
  ],
  distanceKm: 5,
  estimatedMinutes: 12,
  estimatedEarnings: 1500,
  earnings: null,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  expiresAt: null,
}

type HandlerMap = Record<string, unknown>

const respondWith =
  (handlers: HandlerMap) =>
  (call: { method: string; path: string }) => {
    const key = `${call.method} ${call.path}`
    return key in handlers ? okResponse(handlers[key]) : undefined
  }

describe('Gateway delivery extendido (e2e) — frontend → GraphQL → REST', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const run = (query: string) => {
    const token = signToken({ userId: 'u1', roles: ['rider'] })
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query))
  }

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('queries', () => {
    it('riderProfile mapea vehículo anidado y ubicación', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/riders/me': rawRider }))

      const res = await run(
        'query { riderProfile { id userId firstName lastName phone available vehicle { type brand model plate } currentLocation { latitude longitude } } }',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        riderProfile: {
          id: 'r1',
          userId: 'u1',
          firstName: 'Juan',
          lastName: 'Perez',
          phone: '11223344',
          available: true,
          vehicle: { type: 'moto', brand: 'Honda', model: 'CG', plate: 'ABC123' },
          currentLocation: { latitude: -34.6, longitude: -58.4 },
        },
      })
    })

    it('trip mapea TripStatus y OrderStatus de las órdenes', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/trips/t1': rawTrip }))

      const res = await run(
        'query { trip(id: "t1") { id riderId status distanceKm estimatedEarnings orders { orderId pickupBranchId status pickupLocation { latitude } deliveryAddress { text } pickedUpAt deliveredAt } } }',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        trip: {
          id: 't1',
          riderId: 'u1',
          status: 'ACTIVE',
          distanceKm: 5,
          estimatedEarnings: 1500,
          orders: [
            {
              orderId: 'ord-1',
              pickupBranchId: 'b1',
              status: 'ON_THE_WAY',
              pickupLocation: { latitude: -34.6 },
              deliveryAddress: { text: 'Av 123' },
              pickedUpAt: '2026-01-01T00:00:30.000Z',
              deliveredAt: null,
            },
          ],
        },
      })
    })

    it('myTrips envía limit/offset y mapea múltiples viajes', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/trips': {
            data: [rawTrip, { ...rawTrip, id: 't2', status: 'completed', orders: [] }],
          },
        }),
      )

      const res = await run('query { myTrips(page: { limit: 5, offset: 10 }) { id status } }').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        myTrips: [
          { id: 't1', status: 'ACTIVE' },
          { id: 't2', status: 'COMPLETED' },
        ],
      })
      const params = queryParams(callFor('GET', '/v1/trips').url)
      expect(params.get('limit')).toBe('5')
      expect(params.get('offset')).toBe('10')
    })

    it('tripOffers mapea expiresAt y métricas', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/trips/offers': { data: [rawTripOffer] } }))

      const res = await run(
        'query { tripOffers { id orderCount distanceKm estimatedMinutes estimatedEarnings expiresAt } }',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ tripOffers: [rawTripOffer] })
    })
  })

  describe('mutaciones (mapeo REST)', () => {
    interface MutationCase {
      name: string
      query: string
      method: 'POST' | 'PATCH'
      path: string
      body?: unknown
      response: unknown
      expected: Record<string, unknown>
    }

    const cases: MutationCase[] = [
      {
        name: 'updateRiderProfile',
        query: 'mutation { updateRiderProfile(input: { phone: "999" }) { id phone } }',
        method: 'PATCH',
        path: '/v1/riders/me',
        body: { phone: '999' },
        response: { ...rawRider, phone: '999' },
        expected: { updateRiderProfile: { id: 'r1', phone: '999' } },
      },
      {
        name: 'updateRiderVehicle',
        query: 'mutation { updateRiderVehicle(input: { type: "bici", brand: "Vairo" }) { id vehicle { type brand } } }',
        method: 'PATCH',
        path: '/v1/riders/me/vehicle',
        body: { type: 'bici', brand: 'Vairo' },
        response: { ...rawRider, vehicle: { type: 'bici', brand: 'Vairo', model: null, plate: null } },
        expected: { updateRiderVehicle: { id: 'r1', vehicle: { type: 'bici', brand: 'Vairo' } } },
      },
      {
        name: 'setRiderAvailability',
        query: 'mutation { setRiderAvailability(online: false) { id available } }',
        method: 'PATCH',
        path: '/v1/riders/me/availability',
        body: { online: false },
        response: { ...rawRider, available: false },
        expected: { setRiderAvailability: { id: 'r1', available: false } },
      },
      {
        name: 'updateRiderLocation',
        query: 'mutation { updateRiderLocation(lat: -34.6, lng: -58.4) { id currentLocation { latitude longitude } } }',
        method: 'PATCH',
        path: '/v1/riders/me/location',
        body: { lat: -34.6, lng: -58.4 },
        response: rawRider,
        expected: { updateRiderLocation: { id: 'r1' } },
      },
      {
        name: 'markOrderPickup',
        query: 'mutation { markOrderPickup(tripId: "t1", orderId: "ord-1") { id status } }',
        method: 'POST',
        path: '/v1/trips/t1/orders/ord-1/pickup',
        response: rawTrip,
        expected: { markOrderPickup: { id: 't1', status: 'ACTIVE' } },
      },
      {
        name: 'markOrderDelivered',
        query: 'mutation { markOrderDelivered(tripId: "t1", orderId: "ord-1") { id status } }',
        method: 'POST',
        path: '/v1/trips/t1/orders/ord-1/deliver',
        response: { ...rawTrip, status: 'completed' },
        expected: { markOrderDelivered: { id: 't1', status: 'COMPLETED' } },
      },
    ]

    it.each(cases)('$name → $method $path', async ({ query, method, path, body, response, expected }) => {
      downstream.setResponder(respondWith({ [`${method} ${path}`]: response }))

      const res = await run(query).expect(200)
      const graphql = res.body as GraphQLBody

      expect(graphql.errors).toBeUndefined()
      expect(graphql.data).toMatchObject(expected)
      const call = callFor(method, path)
      if (body !== undefined) {
        expect(call.body).toEqual(body)
      }
    })
  })
})
