import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { Model } from 'mongoose'
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

interface DeliveryOrderRow {
  orderId: string
  branchId: string
  branchLocation: { latitude: number; longitude: number }
  deliveryAddress: { text: string; latitude: number; longitude: number }
  status: string
}

const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

describe('Delivery Service (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let orderModel: Model<DeliveryOrderRow>
  let eventBus: EventBus
  let commercePatch: jest.Mock

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create()

    commercePatch = jest.fn().mockResolvedValue(undefined)
    const authClient = {
      getUser: jest.fn().mockResolvedValue({
        id: 'rider-1',
        firstName: 'Rider',
        lastName: 'Test',
        phone: '11223344',
        vehicle: 'Moto',
        role: 'rider',
      }),
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

    orderModel = app.get<Model<DeliveryOrderRow>>(getModelToken('DeliveryOrder'))
    eventBus = app.get(EventBus)
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('perfil del repartidor (RQ-DLV-01/02/11)', () => {
    it('onboarding lazy: crea el rider desde Auth al consultar el perfil', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/riders/me')
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(200)

      expect(res.body.userId).toBe('rider-1')
      expect(res.body.vehicle).toBe('Moto')
      expect(res.body.firstName).toBe('Rider')
      expect(res.body.available).toBe(false)
    })

    it('activa disponibilidad y comparte ubicación', async () => {
      await request(app.getHttpServer())
        .patch('/v1/riders/me/availability')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ online: true })
        .expect(200)

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me/location')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ lat: 0, lng: 0 })
        .expect(200)

      expect(res.body.available).toBe(true)
      expect(res.body.currentLocation).toEqual({ latitude: 0, longitude: 0 })
    })

    it('modifica vehículo y teléfono del perfil', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ vehicle: 'Bici', phone: '999' })
        .expect(200)

      expect(res.body.vehicle).toBe('Bici')
      expect(res.body.phone).toBe('999')
    })

    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/riders/me').expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('rechaza a un no-rider con 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/riders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('validación de DTOs (RQ-DLV-01/02)', () => {
    it('rechaza disponibilidad sin el campo online', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me/availability')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({})
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it.each([
      { name: 'latitud fuera de rango', body: { lat: 100, lng: 0 } },
      { name: 'longitud fuera de rango', body: { lat: 0, lng: 200 } },
      { name: 'coordenadas faltantes', body: { lat: 0 } },
    ])('rechaza ubicación con $name', async ({ body }) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me/location')
        .set('Authorization', `Bearer ${riderToken}`)
        .send(body)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('consumo del evento order.status_changed (RQ-DLV-03)', () => {
    it('agrega al pool una orden READY_FOR_DELIVERY', async () => {
      eventBus.publish({
        type: 'order.status_changed',
        version: 1,
        eventId: 'e2e-1',
        orderId: 'ord-evento',
        status: 'ready_for_delivery',
        branchId: 'b1',
        branchLocation: { latitude: 0.001, longitude: 0 },
        deliveryAddress: { text: 'Av Evento', latitude: 0.002, longitude: 0 },
        occurredAt: new Date().toISOString(),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const doc = await orderModel.findOne({ orderId: 'ord-evento' }).exec()
      expect(doc).not.toBeNull()
      expect(doc?.status).toBe('ready')
    })

    it('quita del pool una orden cancelada', async () => {
      eventBus.publish({
        type: 'order.status_changed',
        version: 1,
        eventId: 'e2e-2',
        orderId: 'ord-evento',
        status: 'cancelled',
        branchId: 'b1',
        branchLocation: { latitude: 0.001, longitude: 0 },
        deliveryAddress: { text: 'Av Evento', latitude: 0.002, longitude: 0 },
        occurredAt: new Date().toISOString(),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const doc = await orderModel.findOne({ orderId: 'ord-evento' }).exec()
      expect(doc).toBeNull()
    })
  })

  describe('flujo de viaje completo (RQ-DLV-04..08)', () => {
    let offerId = ''
    let tripId = ''

    it('ofrece un viaje y lo acepta', async () => {
      await orderModel.create({
        orderId: 'ord-1',
        branchId: 'b1',
        branchLocation: { latitude: 0.001, longitude: 0 },
        deliveryAddress: { text: 'Av 123', latitude: 0.002, longitude: 0 },
        status: 'ready',
      })

      const offers = await request(app.getHttpServer())
        .get('/v1/trips/offers')
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(200)

      expect(offers.body.data).toHaveLength(1)
      expect(offers.body.data[0].orderCount).toBe(1)
      offerId = offers.body.data[0].id as string

      const accepted = await request(app.getHttpServer())
        .post(`/v1/trips/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(201)

      expect(accepted.body.status).toBe('active')
      tripId = accepted.body.id as string
    })

    it('marca el retiro y la entrega, completando el viaje', async () => {
      const pickup = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-1/pickup`)
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(201)

      expect(pickup.body.orders[0].status).toBe('on_the_way')
      expect(commercePatch).toHaveBeenCalledWith('ord-1', 'on_the_way')

      const delivered = await request(app.getHttpServer())
        .post(`/v1/trips/${tripId}/orders/ord-1/deliver`)
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(201)

      expect(delivered.body.status).toBe('completed')
      expect(delivered.body.earnings).toBeGreaterThan(0)
      expect(commercePatch).toHaveBeenCalledWith('ord-1', 'delivered')
    })

    it('lista el historial de viajes del repartidor', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/trips')
        .set('Authorization', `Bearer ${riderToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].status).toBe('completed')
      expect(res.body.meta.total).toBe(1)
    })

    it('no expone el viaje de otro repartidor', async () => {
      const otherToken = jwt.sign({ userId: 'rider-2', roles: ['rider'] }, env.jwtSecret)

      const res = await request(app.getHttpServer())
        .get(`/v1/trips/${tripId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)

      expect(res.body.code).toBe('TRIP_NOT_FOUND')
    })
  })
})
