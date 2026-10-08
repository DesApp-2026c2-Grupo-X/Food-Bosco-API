import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  errorResponse,
  gql,
  GraphQLBody,
  okResponse,
  signToken,
} from './downstream'

describe('Gateway delivery extendido (e2e) — gaps de errores, tripOffers y autorización', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    await app.listen(0)
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const post = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req.send(gql(query))
  }

  const rider = () => signToken({ userId: 'u1', roles: ['rider'] })
  const run = (query: string) => post(query, rider())

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('propagación de errores downstream (delivery)', () => {
    interface ErrorCase {
      name: string
      query: string
      method: 'GET' | 'PATCH' | 'POST'
      restPath: string
      gqlField: string
      status: number
      code: string
      message: string
      fallback?: boolean
    }

    const cases: ErrorCase[] = [
      {
        name: 'acceptTripOffer 404',
        query: 'mutation { acceptTripOffer(offerId: "of1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/offers/of1/accept',
        gqlField: 'acceptTripOffer',
        status: 404,
        code: 'OFFER_NOT_FOUND',
        message: 'Oferta inexistente',
      },
      {
        name: 'acceptTripOffer 409',
        query: 'mutation { acceptTripOffer(offerId: "of1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/offers/of1/accept',
        gqlField: 'acceptTripOffer',
        status: 409,
        code: 'OFFER_STATE_CONFLICT',
        message: 'La oferta ya no está disponible',
      },
      {
        name: 'rejectTripOffer 404',
        query: 'mutation { rejectTripOffer(offerId: "of1") }',
        method: 'POST',
        restPath: '/v1/trips/offers/of1/reject',
        gqlField: 'rejectTripOffer',
        status: 404,
        code: 'OFFER_NOT_FOUND',
        message: 'Oferta inexistente',
      },
      {
        name: 'rejectTripOffer 409',
        query: 'mutation { rejectTripOffer(offerId: "of1") }',
        method: 'POST',
        restPath: '/v1/trips/offers/of1/reject',
        gqlField: 'rejectTripOffer',
        status: 409,
        code: 'OFFER_STATE_CONFLICT',
        message: 'La oferta ya no está disponible',
      },
      {
        name: 'markOrderPickup 404',
        query: 'mutation { markOrderPickup(tripId: "t1", orderId: "o1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/t1/orders/o1/pickup',
        gqlField: 'markOrderPickup',
        status: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Orden inexistente',
      },
      {
        name: 'markOrderPickup 409',
        query: 'mutation { markOrderPickup(tripId: "t1", orderId: "o1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/t1/orders/o1/pickup',
        gqlField: 'markOrderPickup',
        status: 409,
        code: 'ORDER_STATE_CONFLICT',
        message: 'Transición inválida',
      },
      {
        name: 'markOrderDelivered 404',
        query: 'mutation { markOrderDelivered(tripId: "t1", orderId: "o1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/t1/orders/o1/deliver',
        gqlField: 'markOrderDelivered',
        status: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Orden inexistente',
      },
      {
        name: 'markOrderDelivered 409',
        query: 'mutation { markOrderDelivered(tripId: "t1", orderId: "o1") { id } }',
        method: 'POST',
        restPath: '/v1/trips/t1/orders/o1/deliver',
        gqlField: 'markOrderDelivered',
        status: 409,
        code: 'ORDER_STATE_CONFLICT',
        message: 'Transición inválida',
      },
      {
        name: 'trip 404',
        query: 'query { trip(id: "t1") { id } }',
        method: 'GET',
        restPath: '/v1/trips/t1',
        gqlField: 'trip',
        status: 404,
        code: 'TRIP_NOT_FOUND',
        message: 'Viaje inexistente',
      },
      {
        name: 'trip 500',
        query: 'query { trip(id: "t1") { id } }',
        method: 'GET',
        restPath: '/v1/trips/t1',
        gqlField: 'trip',
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'delivery devolvió HTTP 500',
        fallback: true,
      },
      {
        name: 'myTrips 404',
        query: 'query { myTrips { id } }',
        method: 'GET',
        restPath: '/v1/trips',
        gqlField: 'myTrips',
        status: 404,
        code: 'TRIP_NOT_FOUND',
        message: 'Viaje inexistente',
      },
      {
        name: 'myTrips 500',
        query: 'query { myTrips { id } }',
        method: 'GET',
        restPath: '/v1/trips',
        gqlField: 'myTrips',
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'delivery devolvió HTTP 500',
        fallback: true,
      },
      {
        name: 'updateRiderVehicle 400',
        query: 'mutation { updateRiderVehicle(input: { type: "bici" }) { id } }',
        method: 'PATCH',
        restPath: '/v1/riders/me/vehicle',
        gqlField: 'updateRiderVehicle',
        status: 400,
        code: 'INVALID_VEHICLE',
        message: 'Vehículo inválido',
      },
    ]

    it.each(cases)(
      '$name propaga code/message/path de $restPath',
      async ({ query, method, restPath, gqlField, status, code, message, fallback }) => {
        downstream.setResponder(() =>
          fallback
            ? { status, body: { message: 'sin code' } }
            : errorResponse(status, code, message, restPath),
        )

        const res = await run(query).expect(200)
        const body = res.body as GraphQLBody

        expect(body.data).toBeNull()
        expect(body.errors).toHaveLength(1)
        expect(body.errors?.[0].message).toBe(message)
        expect(body.errors?.[0].extensions).toEqual({ code, path: restPath })
        expect(body.errors?.[0].path).toEqual([gqlField])
        expect(callFor(method, restPath)).toBeDefined()
      },
    )
  })

  describe('tripOffers', () => {
    it('devuelve lista vacía sin errores', async () => {
      downstream.setResponder(() => okResponse({ data: [] }))

      const res = await run('query { tripOffers { id } }').expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({ tripOffers: [] })
      expect(callFor('GET', '/v1/trips/offers')).toBeDefined()
    })
  })

  describe('autorización por operación (delivery)', () => {
    const protectedOps: Array<{ name: string; query: string }> = [
      { name: 'tripOffers', query: 'query { tripOffers { id } }' },
      { name: 'trip', query: 'query { trip(id: "t1") { id } }' },
      { name: 'myTrips', query: 'query { myTrips { id } }' },
      {
        name: 'updateRiderProfile',
        query: 'mutation { updateRiderProfile(input: { phone: "9" }) { id } }',
      },
      {
        name: 'updateRiderVehicle',
        query: 'mutation { updateRiderVehicle(input: { type: "moto" }) { id } }',
      },
      {
        name: 'setRiderAvailability',
        query: 'mutation { setRiderAvailability(online: false) { id } }',
      },
      {
        name: 'updateRiderLocation',
        query: 'mutation { updateRiderLocation(lat: -34.6, lng: -58.4) { id } }',
      },
      { name: 'acceptTripOffer', query: 'mutation { acceptTripOffer(offerId: "of1") { id } }' },
      { name: 'rejectTripOffer', query: 'mutation { rejectTripOffer(offerId: "of1") }' },
      {
        name: 'markOrderPickup',
        query: 'mutation { markOrderPickup(tripId: "t1", orderId: "o1") { id } }',
      },
      {
        name: 'markOrderDelivered',
        query: 'mutation { markOrderDelivered(tripId: "t1", orderId: "o1") { id } }',
      },
    ]

    it.each(protectedOps)('$name sin token → UNAUTHENTICATED', async ({ query }) => {
      const res = await post(query).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })

    it.each(protectedOps)('$name con rol customer → FORBIDDEN', async ({ query }) => {
      const res = await post(query, signToken({ userId: 'u1', roles: ['customer'] })).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })
})
