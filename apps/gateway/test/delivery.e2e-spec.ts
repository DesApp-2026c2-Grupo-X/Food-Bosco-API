import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'

const rider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: 'Moto',
  phone: '11223344',
  available: true,
  currentLocation: { latitude: -34.6, longitude: -58.4 },
}

const tripOffer = {
  id: 't1',
  orderCount: 2,
  distanceKm: 5.5,
  estimatedMinutes: 13,
  estimatedEarnings: 1200,
  expiresAt: '2026-01-01T00:01:00.000Z',
}

const trip = {
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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const route = (method: Method, pathname: string): unknown => {
  if (method === 'GET' && pathname === '/v1/riders/me') return rider
  if (method === 'PATCH' && pathname === '/v1/riders/me') return rider
  if (method === 'PATCH' && pathname === '/v1/riders/me/availability') return rider
  if (method === 'PATCH' && pathname === '/v1/riders/me/location') return rider
  if (method === 'GET' && pathname === '/v1/trips/offers') return { data: [tripOffer] }
  if (method === 'GET' && pathname === '/v1/trips') return { data: [trip] }
  if (method === 'GET' && pathname.startsWith('/v1/trips/')) return trip
  if (method === 'POST' && pathname.endsWith('/accept')) return trip
  if (method === 'POST' && pathname.endsWith('/reject')) return { ok: true }
  if (method === 'POST' && pathname.endsWith('/pickup')) return trip
  if (method === 'POST' && pathname.endsWith('/deliver')) return trip
  return null
}

let originalFetch: typeof fetch

const mockFetch = (): void => {
  originalFetch = global.fetch

  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input))
    const body = route((init?.method ?? 'GET') as Method, url.pathname)

    if (body === null) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ code: 'NOT_FOUND', message: 'not found', path: url.pathname }),
      } as unknown as Response
    }

    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }) as unknown as typeof fetch
}

const gql = (query: string) => ({ query })

const sign = (payload: object): string => jwt.sign(payload, env.jwtSecret)

describe('Gateway delivery (e2e) — frontend → GraphQL → REST', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    mockFetch()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    global.fetch = originalFetch
    await app.close()
  })

  it('expone riderProfile para el repartidor', async () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { riderProfile { id firstName available currentLocation { latitude } } }'))
      .expect(200)

    expect(res.body.data.riderProfile).toEqual({
      id: 'r1',
      firstName: 'Juan',
      available: true,
      currentLocation: { latitude: -34.6 },
    })
  })

  it('expone tripOffers y mapea la ganancia', async () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(
        gql('query { tripOffers { id orderCount distanceKm estimatedMinutes estimatedEarnings } }'),
      )
      .expect(200)

    expect(res.body.data.tripOffers).toEqual([
      {
        id: 't1',
        orderCount: 2,
        distanceKm: 5.5,
        estimatedMinutes: 13,
        estimatedEarnings: 1200,
      },
    ])
  })

  it('expone myTrips y mapea status/orders a enums', async () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { myTrips { id status orders { orderId status } } }'))
      .expect(200)

    expect(res.body.data.myTrips).toEqual([
      { id: 't1', status: 'ACTIVE', orders: [{ orderId: 'ord-1', status: 'ON_THE_WAY' }] },
    ])
  })

  it('expone acceptTripOffer y devuelve el viaje activo', async () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('mutation { acceptTripOffer(offerId: "t1") { id status } }'))
      .expect(200)

    expect(res.body.data.acceptTripOffer).toEqual({ id: 't1', status: 'ACTIVE' })
  })

  it('expone rejectTripOffer y devuelve true', async () => {
    const token = sign({ userId: 'u1', roles: ['rider'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('mutation { rejectTripOffer(offerId: "t1") }'))
      .expect(200)

    expect(res.body.data.rejectTripOffer).toBe(true)
  })

  it('rechaza a un cliente acceder a riderProfile', async () => {
    const token = sign({ userId: 'c1', roles: ['customer'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { riderProfile { id } }'))
      .expect(200)

    expect(res.body.errors).toHaveLength(1)
    expect(typeof res.body.errors[0].extensions.code).toBe('string')
    expect(res.body.data).toBeNull()
  })
})
