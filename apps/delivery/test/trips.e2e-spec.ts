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
import { InProcessTransport } from '../src/config/messaging/in-process.transport'
import { SecurityModule } from '../src/config/security/security.module'
import { DeliveryOrderModule } from '../src/delivery-order/delivery-order.module'
import { OfferModule } from '../src/offer/offer.module'
import { RiderModule } from '../src/rider/rider.module'
import { TripModule } from '../src/trip/trip.module'
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
  distanceKm: number
  estimatedMinutes: number
  estimatedEarnings: number
  earnings: number | null
  expiresAt: Date | null
}

interface RiderRow {
  userId: string
  firstName: string
  lastName: string
  phone: string
  available: boolean
  status: string
  currentLocation: GeoPoint | null
}

interface ProcessedEventRow {
  eventId: string
}

const tokenFor = (userId: string): string => jwt.sign({ userId, roles: ['rider'] }, env.jwtSecret)
const bearer = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` })
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('Delivery trips (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let orderModel: Model<DeliveryOrderRow>
  let tripModel: Model<TripRow>
  let riderModel: Model<RiderRow>
  let processedModel: Model<ProcessedEventRow>
  let commercePatch: jest.Mock

  const rider1 = tokenFor('rider-1')
  const rider2 = tokenFor('rider-2')

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
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  beforeEach(async () => {
    commercePatch.mockClear()
    await Promise.all([
      orderModel.deleteMany({}),
      tripModel.deleteMany({}),
      riderModel.deleteMany({}),
      processedModel.deleteMany({}),
    ])
  })

  const seedReadyOrder = (orderId: string): Promise<unknown> =>
    orderModel.create({
      orderId,
      branchId: 'b1',
      branchLocation: { latitude: 0.001, longitude: 0 },
      deliveryAddress: { text: 'Av 123', latitude: 0.002, longitude: 0 },
      status: 'ready',
    })

  const onboard = async (
    userId: string,
    location: GeoPoint | null = { latitude: 0, longitude: 0 },
  ): Promise<void> => {
    await request(app.getHttpServer())
      .get('/v1/riders/me')
      .set(bearer(tokenFor(userId)))
      .expect(200)
    await request(app.getHttpServer())
      .patch('/v1/riders/me/availability')
      .set(bearer(tokenFor(userId)))
      .send({ online: true })
      .expect(200)
    if (location) {
      await request(app.getHttpServer())
        .patch('/v1/riders/me/location')
        .set(bearer(tokenFor(userId)))
        .send({ lat: location.latitude, lng: location.longitude })
        .expect(200)
    }
  }

  const createOffer = async (userId: string, orderId = 'ord-1'): Promise<string> => {
    await seedReadyOrder(orderId)
    const res = await request(app.getHttpServer())
      .get('/v1/trips/offers')
      .set(bearer(tokenFor(userId)))
      .expect(200)
    return res.body.data[0].id as string
  }

  const acceptOffer = async (userId: string, offerId: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post(`/v1/trips/offers/${offerId}/accept`)
      .set(bearer(tokenFor(userId)))
      .expect(201)
    return res.body.id as string
  }

  describe('GET /v1/trips/offers', () => {
    it('ofrece al rider disponible una orden lista del pool', async () => {
      await onboard('rider-1')
      await seedReadyOrder('ord-happy')

      const res = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set(bearer(rider1))
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].orderCount).toBe(1)
      expect(res.body.data[0].estimatedEarnings).toBeGreaterThan(0)
      expect(typeof res.body.data[0].expiresAt).toBe('string')
    })

    it('rechaza con 409 RIDER_OFFLINE cuando el rider no está disponible', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('RIDER_OFFLINE')
    })

    it('rechaza con 409 LOCATION_REQUIRED cuando el rider está online sin ubicación', async () => {
      await onboard('rider-1', null)

      const res = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('LOCATION_REQUIRED')
    })

    it('no ofrece viajes a un rider que está en viaje (on_trip)', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1', 'ord-on-trip')
      await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set(bearer(rider1))
        .expect(200)

      expect(res.body.data).toEqual([])
    })

    it('libera las reservas vencidas (TTL) y vuelve a ofertar la orden', async () => {
      await onboard('rider-1')

      const expiredTrip = await tripModel.create({
        riderId: 'rider-1',
        status: 'offered',
        orders: [],
        distanceKm: 1,
        estimatedMinutes: 1,
        estimatedEarnings: 100,
        expiresAt: new Date(Date.now() - 60_000),
      })

      await orderModel.create({
        orderId: 'ord-ttl',
        branchId: 'b1',
        branchLocation: { latitude: 0.001, longitude: 0 },
        deliveryAddress: { text: 'Av TTL', latitude: 0.002, longitude: 0 },
        status: 'reserved',
        tripId: expiredTrip._id.toString(),
        reservedUntil: new Date(Date.now() - 60_000),
      })

      const res = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set(bearer(rider1))
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].id).not.toBe(expiredTrip._id.toString())

      const oldTrip = await tripModel.findById(expiredTrip._id).exec()
      expect(oldTrip?.status).toBe('cancelled')

      const order = await orderModel.findOne({ orderId: 'ord-ttl' }).exec()
      expect(order?.status).toBe('reserved')
      expect(order?.tripId).toBe(res.body.data[0].id)
    })
  })

  describe('POST /v1/trips/offers/:offerId/accept', () => {
    it('acepta la oferta y deja al rider en on_trip', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1', 'ord-accept')

      const accepted = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/accept`)
        .set(bearer(rider1))
        .expect(201)

      expect(accepted.body.status).toBe('active')
      expect(accepted.body.orders).toHaveLength(1)

      const me = await request(app.getHttpServer())
        .get('/v1/riders/me')
        .set(bearer(rider1))
        .expect(200)

      expect(me.body.status).toBe('on_trip')
    })

    it('devuelve 404 al aceptar una oferta de otro rider', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/accept`)
        .set(bearer(rider2))
        .expect(404)

      expect(res.body.code).toBe('OFFER_NOT_FOUND')
    })

    it('devuelve 409 cuando la oferta ya no está en estado offered', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')
      await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/accept`)
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRIP_STATUS')
    })

    it('devuelve 409 cuando la oferta expiró', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')
      await tripModel.updateOne({ _id: offerId }, { expiresAt: new Date(Date.now() - 1000) }).exec()

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/accept`)
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('OFFER_EXPIRED')
    })
  })

  describe('POST /v1/trips/offers/:offerId/reject', () => {
    it('rechaza la oferta y devuelve la orden al pool', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1', 'ord-reject')

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/reject`)
        .set(bearer(rider1))
        .expect(200)

      expect(res.body).toEqual({ ok: true })

      const order = await orderModel.findOne({ orderId: 'ord-reject' }).exec()
      expect(order?.status).toBe('ready')
      expect(order?.tripId).toBeNull()

      const trip = await tripModel.findById(offerId).exec()
      expect(trip?.status).toBe('cancelled')
    })

    it('devuelve 404 al rechazar una oferta de otro rider', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/reject`)
        .set(bearer(rider2))
        .expect(404)

      expect(res.body.code).toBe('OFFER_NOT_FOUND')
    })

    it('devuelve 409 cuando la oferta no está en estado offered', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')
      await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/reject`)
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRIP_STATUS')
    })
  })

  describe('POST /v1/trips/:tripId/orders/:orderId/pickup y /deliver', () => {
    it('marca el retiro y notifica a Commerce con on_the_way', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1', 'ord-pickup')
      const tripId = await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-pickup/pickup`)
        .set(bearer(rider1))
        .expect(201)

      expect(res.body.orders[0].status).toBe('on_the_way')
      expect(commercePatch).toHaveBeenCalledWith('ord-pickup', 'on_the_way')
    })

    it('marca la entrega, liquida earnings y libera al rider', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1', 'ord-deliver')
      const tripId = await acceptOffer('rider-1', offerId)
      await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-deliver/pickup`)
        .set(bearer(rider1))
        .expect(201)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-deliver/deliver`)
        .set(bearer(rider1))
        .expect(201)

      expect(res.body.status).toBe('completed')
      expect(res.body.earnings).toBeGreaterThan(0)
      expect(commercePatch).toHaveBeenCalledWith('ord-deliver', 'delivered')

      const me = await request(app.getHttpServer())
        .get('/v1/riders/me')
        .set(bearer(rider1))
        .expect(200)
      expect(me.body.status).toBe('free')
    })

    it('devuelve 404 al operar un viaje de otro rider', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')
      const tripId = await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-1/pickup`)
        .set(bearer(rider2))
        .expect(404)

      expect(res.body.code).toBe('TRIP_NOT_FOUND')
    })

    it('devuelve 404 cuando la orden no pertenece al viaje', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')
      const tripId = await acceptOffer('rider-1', offerId)

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-inexistente/pickup`)
        .set(bearer(rider1))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_IN_TRIP')
    })

    it('devuelve 409 al operar un viaje que no está activo', async () => {
      await onboard('rider-1')
      const offeredTripId = await createOffer('rider-1')

      const res = await request(app.getHttpServer())
        .post(`/v1/trips/${offeredTripId}/orders/ord-1/pickup`)
        .set(bearer(rider1))
        .expect(409)

      expect(res.body.code).toBe('INVALID_TRIP_STATUS')
    })
  })

  describe('GET /v1/trips', () => {
    it('pagina el historial con limit y offset reales', async () => {
      const ids: string[] = []
      for (let index = 0; index < 3; index += 1) {
        const created = await tripModel.create({
          riderId: 'rider-1',
          status: 'completed',
          orders: [],
          distanceKm: 1,
          estimatedMinutes: 1,
          estimatedEarnings: 100,
          earnings: 100,
        })
        ids.push(created._id.toString())
        await sleep(2)
      }

      const page1 = await request(app.getHttpServer())
        .get('/v1/trips?limit=2&offset=0')
        .set(bearer(rider1))
        .expect(200)

      expect(page1.body.data).toHaveLength(2)
      expect(page1.body.meta).toEqual({ total: 3, limit: 2, offset: 0 })

      const page2 = await request(app.getHttpServer())
        .get('/v1/trips?limit=2&offset=2')
        .set(bearer(rider1))
        .expect(200)

      expect(page2.body.data).toHaveLength(1)
      expect(page2.body.meta).toEqual({ total: 3, limit: 2, offset: 2 })

      const seen = new Set<string>([
        ...page1.body.data.map((trip: { id: string }) => trip.id),
        ...page2.body.data.map((trip: { id: string }) => trip.id),
      ])
      expect(seen.size).toBe(3)
      for (const id of ids) {
        expect(seen.has(id)).toBe(true)
      }
    })

    it('rechaza un limit fuera de rango', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/trips?limit=0')
        .set(bearer(rider1))
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/trips/:tripId', () => {
    it('devuelve el viaje propio', async () => {
      await onboard('rider-1')
      const offerId = await createOffer('rider-1')

      const res = await request(app.getHttpServer())
        .get(`/v1/trips/${offerId}`)
        .set(bearer(rider1))
        .expect(200)

      expect(res.body.id).toBe(offerId)
      expect(res.body.riderId).toBe('rider-1')
    })

    it('devuelve 404 para un viaje inexistente', async () => {
      const missing = new Types.ObjectId().toString()

      const res = await request(app.getHttpServer())
        .get(`/v1/trips/${missing}`)
        .set(bearer(rider1))
        .expect(404)

      expect(res.body.code).toBe('TRIP_NOT_FOUND')
    })
  })
})
