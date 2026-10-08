import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getConnectionToken, getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { createConnection, Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { AuthClient } from '../src/config/http/auth.client'
import { CommerceClient } from '../src/config/http/commerce.client'
import { env } from '../src/config/env'
import { EventBus } from '../src/config/messaging/event-bus'
import { InProcessTransport } from '../src/config/messaging/in-process.transport'
import { SecurityModule } from '../src/config/security/security.module'
import { OfferModule } from '../src/offer/offer.module'
import { RiderModule } from '../src/rider/rider.module'
import { SeedModule } from '../src/seed/seed.module'
import { ShiftModule } from '../src/shift/shift.module'
import { ZoneModule } from '../src/zone/zone.module'
import { createMongoServer } from './mongo'

interface RiderRow {
  userId: string
}

interface ZoneRow {
  name: string
}

interface ShiftRow {
  name: string
}

// Igual que delivery-admin.e2e-spec.ts: SeedModule importa DatabaseModule, que hace
// MongooseModule.forRoot(env.mongoUri). Para no conectar a un Mongo real se reemplaza el
// token de conexión por defecto ANTES de compilar, de modo que la factory de forRoot nunca corre.
describe('Delivery admin — edge cases (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let riderModel: Model<RiderRow>
  let zoneModel: Model<ZoneRow>
  let shiftModel: Model<ShiftRow>

  beforeAll(async () => {
    mongod = await createMongoServer()
    const connection = await createConnection(mongod.getUri()).asPromise()

    const authClient = {
      getUser: jest.fn(async (userId: string) => ({
        id: userId,
        firstName: 'Edge',
        lastName: 'Rider',
        phone: '11223344',
        vehicle: 'Moto',
        role: 'rider',
      })),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule, RiderModule, ZoneModule, ShiftModule, SeedModule, OfferModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(AuthClient)
      .useValue(authClient)
      .overrideProvider(CommerceClient)
      .useValue({ patchOrderStatus: jest.fn() })
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

    riderModel = app.get<Model<RiderRow>>(getModelToken('Rider'))
    zoneModel = app.get<Model<ZoneRow>>(getModelToken('Zone'))
    shiftModel = app.get<Model<ShiftRow>>(getModelToken('Shift'))
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  beforeEach(async () => {
    await Promise.all([
      riderModel.deleteMany({}),
      zoneModel.deleteMany({}),
      shiftModel.deleteMany({}),
    ])
  })

  const bearer = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
  })
  const riderToken = (userId: string): string =>
    jwt.sign({ userId, roles: ['rider'] }, env.jwtSecret)
  const customerToken = jwt.sign({ userId: 'edge-customer', roles: ['customer'] }, env.jwtSecret)

  describe('@Internal con x-internal-token inválido en los create', () => {
    const cases: Array<{ name: string; path: string; body: Record<string, unknown> }> = [
      {
        name: 'POST /v1/zones',
        path: '/v1/zones',
        body: { name: 'Centro', center: { latitude: -34.6, longitude: -58.6 }, radiusKm: 4 },
      },
      {
        name: 'POST /v1/shifts',
        path: '/v1/shifts',
        body: { name: 'Mañana', startTime: '08:00', endTime: '13:00' },
      },
      {
        name: 'POST /v1/seed',
        path: '/v1/seed',
        body: { userId: 'edge-seed', firstName: 'Edge', lastName: 'Seed', phone: '555' },
      },
    ]

    it.each(cases)(
      '$name con token interno incorrecto → 401 UNAUTHENTICATED',
      async ({ path, body }) => {
        const res = await request(app.getHttpServer())
          .post(path)
          .set('x-internal-token', 'token-incorrecto')
          .send(body)
          .expect(401)

        expect(res.body.code).toBe('UNAUTHENTICATED')
      },
    )
  })

  describe('ObjectId malformado en el path', () => {
    const publicCases: Array<{ name: string; path: string; code: string }> = [
      { name: 'GET /v1/zones/:id', path: '/v1/zones/abc', code: 'ZONE_NOT_FOUND' },
      { name: 'GET /v1/shifts/:id', path: '/v1/shifts/abc', code: 'SHIFT_NOT_FOUND' },
    ]

    it.each(publicCases)('$name con id "abc" → 404 $code', async ({ path, code }) => {
      const res = await request(app.getHttpServer()).get(path).expect(404)

      expect(res.body.code).toBe(code)
    })

    it('GET /v1/trips/:tripId con id "abc" (rider) → 404 TRIP_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/trips/abc')
        .set(bearer(riderToken('edge-rider')))
        .expect(404)

      expect(res.body.code).toBe('TRIP_NOT_FOUND')
    })
  })

  describe('@Roles(rider) en los PATCH de /v1/riders/me', () => {
    const routes: Array<{ name: string; path: string }> = [
      { name: 'PATCH /v1/riders/me', path: '/v1/riders/me' },
      { name: 'PATCH /v1/riders/me/vehicle', path: '/v1/riders/me/vehicle' },
      { name: 'PATCH /v1/riders/me/availability', path: '/v1/riders/me/availability' },
      { name: 'PATCH /v1/riders/me/location', path: '/v1/riders/me/location' },
    ]

    it.each(routes)('$name sin token → 401 UNAUTHENTICATED', async ({ path }) => {
      const res = await request(app.getHttpServer()).patch(path).expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each(routes)('$name con rol customer → 403 FORBIDDEN', async ({ path }) => {
      const res = await request(app.getHttpServer())
        .patch(path)
        .set(bearer(customerToken))
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
