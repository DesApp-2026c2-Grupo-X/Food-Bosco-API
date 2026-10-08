import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { AuthClient } from '../src/config/http/auth.client'
import { CommerceClient } from '../src/config/http/commerce.client'
import { EventBus } from '../src/config/messaging/event-bus'
import { TRIP_ACCEPTED_EVENT, TRIP_COMPLETED_EVENT } from '../src/config/messaging/events'
import type {
  DomainEvent,
  TripAcceptedEvent,
  TripCompletedEvent,
} from '../src/config/messaging/events'
import { InProcessTransport } from '../src/config/messaging/in-process.transport'
import { SecurityModule } from '../src/config/security/security.module'
import { DeliveryOrderModule } from '../src/delivery-order/delivery-order.module'
import { OfferModule } from '../src/offer/offer.module'
import { RiderModule } from '../src/rider/rider.module'
import { ShiftModule } from '../src/shift/shift.module'
import { TripModule } from '../src/trip/trip.module'
import { ZoneModule } from '../src/zone/zone.module'
import { createMongoServer } from './mongo'

interface GeoPoint {
  latitude: number
  longitude: number
}

interface DeliveryOrderRow {
  orderId: string
  branchId: string
  branchLocation: GeoPoint
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: string
  tripId: string | null
  reservedUntil: Date | null
}

interface TripRow {
  _id: Types.ObjectId
  riderId: string
  status: string
  orders: unknown[]
}

interface RiderRow {
  userId: string
  available: boolean
  status: string
}

interface ProcessedEventRow {
  eventId: string
}

type HttpMethod = 'get' | 'post'

const tokenFor = (userId: string, roles: string[] = ['rider']): string =>
  jwt.sign({ userId, roles }, env.jwtSecret)
const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` })

const riderToken = tokenFor('rider-authz')
const customerToken = tokenFor('cust-authz', ['customer'])

const offerId = new Types.ObjectId().toString()
const tripId = new Types.ObjectId().toString()

const tripsRoutes: Array<{ method: HttpMethod; path: string }> = [
  { method: 'get', path: '/v1/trips/offers' },
  { method: 'post', path: `/v1/trips/offers/${offerId}/accept` },
  { method: 'post', path: `/v1/trips/offers/${offerId}/reject` },
  { method: 'post', path: `/v1/trips/${tripId}/orders/ord-1/pickup` },
  { method: 'post', path: `/v1/trips/${tripId}/orders/ord-1/deliver` },
  { method: 'get', path: '/v1/trips' },
  { method: 'get', path: `/v1/trips/${tripId}` },
]

const activePaths: Array<{ name: string; path: string }> = [
  { name: 'zonas', path: `/v1/zones/${new Types.ObjectId().toString()}/active` },
  { name: 'turnos', path: `/v1/shifts/${new Types.ObjectId().toString()}/active` },
]

describe('Delivery autorización y eventos (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let orderModel: Model<DeliveryOrderRow>
  let tripModel: Model<TripRow>
  let riderModel: Model<RiderRow>
  let processedModel: Model<ProcessedEventRow>
  let commercePatch: jest.Mock
  let eventBus: EventBus
  let publishSpy: jest.SpyInstance<Promise<void>, [DomainEvent]>

  beforeAll(async () => {
    mongod = await createMongoServer()

    commercePatch = jest.fn().mockResolvedValue(undefined)
    const authClient = {
      getUser: jest.fn(async (userId: string) => ({
        id: userId,
        firstName: 'Rider',
        lastName: 'Test',
        phone: '11223344',
        vehicle: 'Moto',
        role: 'rider',
      })),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        RiderModule,
        DeliveryOrderModule,
        OfferModule,
        TripModule,
        ZoneModule,
        ShiftModule,
      ],
    })
      .overrideProvider(AuthClient)
      .useValue(authClient)
      .overrideProvider(CommerceClient)
      .useValue({ patchOrderStatus: commercePatch })
      .overrideProvider(EventBus)
      .useValue(new EventBus(new InProcessTransport()))
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    await app.listen(0)

    orderModel = app.get<Model<DeliveryOrderRow>>(getModelToken('DeliveryOrder'))
    tripModel = app.get<Model<TripRow>>(getModelToken('Trip'))
    riderModel = app.get<Model<RiderRow>>(getModelToken('Rider'))
    processedModel = app.get<Model<ProcessedEventRow>>(getModelToken('ProcessedEvent'))

    eventBus = app.get(EventBus)
    publishSpy = jest.spyOn(eventBus, 'publish')
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  beforeEach(async () => {
    commercePatch.mockClear()
    publishSpy.mockClear()
    await Promise.all([
      orderModel.deleteMany({}),
      tripModel.deleteMany({}),
      riderModel.deleteMany({}),
      processedModel.deleteMany({}),
    ])
  })

  const authedRequest = (method: HttpMethod, path: string, token?: string): request.Test => {
    const server = app.getHttpServer()
    const req = method === 'get' ? request(server).get(path) : request(server).post(path)
    return token ? req.set('Authorization', `Bearer ${token}`) : req
  }

  const onboard = async (
    userId: string,
    location: GeoPoint | null = { latitude: 0, longitude: 0 },
  ): Promise<void> => {
    const token = tokenFor(userId)
    await request(app.getHttpServer()).get('/v1/riders/me').set(bearer(token)).expect(200)
    await request(app.getHttpServer())
      .patch('/v1/riders/me/availability')
      .set(bearer(token))
      .send({ online: true })
      .expect(200)
    if (location) {
      await request(app.getHttpServer())
        .patch('/v1/riders/me/location')
        .set(bearer(token))
        .send({ lat: location.latitude, lng: location.longitude })
        .expect(200)
    }
  }

  const seedReadyOrder = (orderIdSeed: string): Promise<unknown> =>
    orderModel.create({
      orderId: orderIdSeed,
      branchId: 'b1',
      branchLocation: { latitude: 0.001, longitude: 0 },
      deliveryAddress: { text: 'Av Eventos', latitude: 0.002, longitude: 0 },
      status: 'ready',
    })

  const listOffers = async (userId: string): Promise<{ id: string; orderCount: number }> => {
    const res = await request(app.getHttpServer())
      .get('/v1/trips/offers')
      .set(bearer(tokenFor(userId)))
      .expect(200)

    return res.body.data[0] as { id: string; orderCount: number }
  }

  const createOffer = async (userId: string, orderIdSeed: string): Promise<string> => {
    await seedReadyOrder(orderIdSeed)
    const offer = await listOffers(userId)
    return offer.id
  }

  const acceptOffer = async (userId: string, id: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/offers/${id}/accept`)
      .set(bearer(tokenFor(userId)))
      .expect(201)

    return res.body.id as string
  }

  describe('Autorización del clúster /v1/trips (@Roles(rider))', () => {
    it.each(tripsRoutes)(
      '401 UNAUTHENTICATED sin token para $method $path',
      async ({ method, path }) => {
        const res = await authedRequest(method, path).expect(401)

        expect(res.body.code).toBe('UNAUTHENTICATED')
      },
    )

    it.each(tripsRoutes)(
      '403 FORBIDDEN con rol customer para $method $path',
      async ({ method, path }) => {
        const res = await authedRequest(method, path, customerToken).expect(403)

        expect(res.body.code).toBe('FORBIDDEN')
      },
    )

    it('un rider autenticado no es rechazado por autorización', async () => {
      const res = await authedRequest('get', '/v1/trips', riderToken).expect(200)

      expect(res.body.data).toEqual([])
    })
  })

  describe('@Internal en la activación de zonas y turnos', () => {
    it.each(activePaths)('$name: PATCH active sin x-internal-token → 401', async ({ path }) => {
      const res = await request(app.getHttpServer()).patch(path).send({ active: false }).expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each(activePaths)(
      '$name: PATCH active con token interno inválido → 401',
      async ({ path }) => {
        const res = await request(app.getHttpServer())
          .patch(path)
          .set('x-internal-token', 'token-incorrecto')
          .send({ active: false })
          .expect(401)

        expect(res.body.code).toBe('UNAUTHENTICATED')
      },
    )
  })

  describe('Validación real de SetActiveDto', () => {
    it.each(activePaths)('$name: active ausente → 400 VALIDATION_ERROR', async ({ path }) => {
      const res = await request(app.getHttpServer())
        .patch(path)
        .set('x-internal-token', env.internalApiToken)
        .send({})
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Eventos de dominio del viaje', () => {
    it('publica trip.accepted al aceptar la oferta', async () => {
      await onboard('rider-events-accept')
      const id = await createOffer('rider-events-accept', 'ord-events-accept')

      await acceptOffer('rider-events-accept', id)

      const events = publishSpy.mock.calls.map(([event]) => event)
      const accepted = events.find(
        (event): event is TripAcceptedEvent => event.type === TRIP_ACCEPTED_EVENT,
      )

      expect(accepted).toBeDefined()
      expect(accepted?.version).toBe(1)
      expect(accepted?.tripId).toBe(id)
      expect(accepted?.riderId).toBe('rider-events-accept')
      expect(accepted?.orderIds).toEqual(['ord-events-accept'])
      expect(typeof accepted?.eventId).toBe('string')
      expect(accepted?.eventId).not.toBe('')
    })

    it('publica trip.completed al entregar la última orden del viaje', async () => {
      await onboard('rider-events-deliver')
      const id = await createOffer('rider-events-deliver', 'ord-events-deliver')
      const acceptedTripId = await acceptOffer('rider-events-deliver', id)

      await request(app.getHttpServer())
        .post(`/v1/trips/${acceptedTripId}/orders/ord-events-deliver/pickup`)
        .set(bearer(tokenFor('rider-events-deliver')))
        .expect(201)

      publishSpy.mockClear()

      await request(app.getHttpServer())
        .post(`/v1/trips/${acceptedTripId}/orders/ord-events-deliver/deliver`)
        .set(bearer(tokenFor('rider-events-deliver')))
        .expect(201)

      const events = publishSpy.mock.calls.map(([event]) => event)
      const completed = events.find(
        (event): event is TripCompletedEvent => event.type === TRIP_COMPLETED_EVENT,
      )

      expect(completed).toBeDefined()
      expect(completed?.version).toBe(1)
      expect(completed?.tripId).toBe(acceptedTripId)
      expect(completed?.riderId).toBe('rider-events-deliver')
      expect(completed?.orderIds).toEqual(['ord-events-deliver'])
      expect(typeof completed?.eventId).toBe('string')
      expect(completed?.eventId).not.toBe('')
    })

    it('no publica trip.completed hasta entregar la última orden del viaje', async () => {
      const rider = 'rider-events-multi'
      await onboard(rider)
      await seedReadyOrder('ord-multi-a')
      await seedReadyOrder('ord-multi-b')

      const offer = await listOffers(rider)
      expect(offer.orderCount).toBe(2)

      const acceptedTripId = await acceptOffer(rider, offer.id)

      for (const orderId of ['ord-multi-a', 'ord-multi-b']) {
        await request(app.getHttpServer())
          .post(`/v1/trips/${acceptedTripId}/orders/${orderId}/pickup`)
          .set(bearer(tokenFor(rider)))
          .expect(201)
      }

      publishSpy.mockClear()

      const partial = await request(app.getHttpServer())
        .post(`/v1/trips/${acceptedTripId}/orders/ord-multi-a/deliver`)
        .set(bearer(tokenFor(rider)))
        .expect(201)

      expect(partial.body.status).toBe('active')
      expect(publishSpy.mock.calls.map(([event]) => event)).not.toContainEqual(
        expect.objectContaining({ type: TRIP_COMPLETED_EVENT }),
      )

      const final = await request(app.getHttpServer())
        .post(`/v1/trips/${acceptedTripId}/orders/ord-multi-b/deliver`)
        .set(bearer(tokenFor(rider)))
        .expect(201)

      expect(final.body.status).toBe('completed')
      expect(publishSpy.mock.calls.map(([event]) => event)).toContainEqual(
        expect.objectContaining({ type: TRIP_COMPLETED_EVENT, tripId: acceptedTripId }),
      )
    })
  })
})
