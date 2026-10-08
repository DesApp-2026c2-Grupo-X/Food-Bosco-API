import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getConnectionToken, getModelToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { createConnection, Model, Types } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { AuthClient } from '../src/config/http/auth.client'
import { CommerceClient } from '../src/config/http/commerce.client'
import { env } from '../src/config/env'
import { SecurityModule } from '../src/config/security/security.module'
import { HealthModule } from '../src/health/health.module'
import { RiderModule } from '../src/rider/rider.module'
import { SeedModule } from '../src/seed/seed.module'
import { ShiftModule } from '../src/shift/shift.module'
import { ZoneModule } from '../src/zone/zone.module'
import { createMongoServer } from './mongo'

interface GeoPoint {
  latitude: number
  longitude: number
}

interface RiderRow {
  userId: string
  firstName: string
  lastName: string
  phone: string
  vehicle: { type: string } | null
  available: boolean
  status: string
}

interface ZoneRow {
  _id: Types.ObjectId
  name: string
  center: GeoPoint
  radiusKm: number
  active: boolean
}

interface ShiftRow {
  _id: Types.ObjectId
  name: string
  startTime: string
  endTime: string
  active: boolean
}

// SeedModule importa DatabaseModule, que hace MongooseModule.forRoot(env.mongoUri). Para no
// conectar a un Mongo real, se levanta un memory-server y se reemplaza el token de conexión
// por defecto ANTES de compilar: la factory de forRoot nunca se ejecuta.
describe('Delivery admin (e2e)', () => {
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
        firstName: 'Onboarded',
        lastName: 'Rider',
        phone: '11223344',
        vehicle: 'Moto',
        role: 'rider',
      })),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule, RiderModule, ZoneModule, ShiftModule, SeedModule, HealthModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(AuthClient)
      .useValue(authClient)
      .overrideProvider(CommerceClient)
      .useValue({ patchOrderStatus: jest.fn() })
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

  const internal = (): { 'x-internal-token': string } => ({
    'x-internal-token': env.internalApiToken,
  })
  const bearer = (token: string): { Authorization: string } => ({
    Authorization: `Bearer ${token}`,
  })
  const riderToken = (userId: string): string =>
    jwt.sign({ userId, roles: ['rider'] }, env.jwtSecret)

  describe('GET /v1/riders/by-user/:userId (@Internal)', () => {
    it('devuelve el rider con token interno', async () => {
      await riderModel.create({
        userId: 'lookup-1',
        firstName: 'Ana',
        lastName: 'Gomez',
        phone: '1',
        vehicle: { type: 'moto' },
      })

      const res = await request(app.getHttpServer())
        .get('/v1/riders/by-user/lookup-1')
        .set(internal())
        .expect(200)

      expect(res.body.userId).toBe('lookup-1')
      expect(res.body.firstName).toBe('Ana')
    })

    it('devuelve 404 si el rider no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/riders/by-user/ghost')
        .set(internal())
        .expect(404)

      expect(res.body.code).toBe('NOT_FOUND')
    })

    it('rechaza sin token interno con 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/riders/by-user/ghost').expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('rechaza con un token inválido con 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/riders/by-user/ghost')
        .set(bearer('not-a-jwt'))
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('Zonas /v1/zones', () => {
    it('lista las zonas existentes', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/zones')
        .set(internal())
        .send({ name: 'Centro', center: { latitude: -34.6, longitude: -58.6 }, radiusKm: 4 })
        .expect(201)

      const list = await request(app.getHttpServer()).get('/v1/zones').expect(200)

      expect(list.body).toHaveLength(1)
      expect(list.body[0].id).toBe(created.body.id)
      expect(list.body[0].name).toBe('Centro')
    })

    it('obtiene una zona por id y 404 ZONE_NOT_FOUND si no existe', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/zones')
        .set(internal())
        .send({ name: 'Norte', center: { latitude: -34.5, longitude: -58.5 }, radiusKm: 3 })
        .expect(201)

      const found = await request(app.getHttpServer())
        .get(`/v1/zones/${created.body.id}`)
        .expect(200)
      expect(found.body.name).toBe('Norte')

      const missing = new Types.ObjectId().toString()
      const notFound = await request(app.getHttpServer()).get(`/v1/zones/${missing}`).expect(404)
      expect(notFound.body.code).toBe('ZONE_NOT_FOUND')
    })

    it('crea una zona (201), valida el DTO y exige token interno', async () => {
      await request(app.getHttpServer())
        .post('/v1/zones')
        .send({ name: 'Sin token', center: { latitude: 0, longitude: 0 }, radiusKm: 1 })
        .expect(401)

      const invalid = await request(app.getHttpServer())
        .post('/v1/zones')
        .set(internal())
        .send({ center: { latitude: 0, longitude: 0 }, radiusKm: 1 })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')

      const created = await request(app.getHttpServer())
        .post('/v1/zones')
        .set(internal())
        .send({ name: 'Sur', center: { latitude: -34.7, longitude: -58.4 }, radiusKm: 5 })
        .expect(201)
      expect(created.body.name).toBe('Sur')
      expect(created.body.active).toBe(true)
    })

    it('activa/desactiva una zona, 404 y validación', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/zones')
        .set(internal())
        .send({ name: 'Oeste', center: { latitude: -34.65, longitude: -58.62 }, radiusKm: 5 })
        .expect(201)

      const toggled = await request(app.getHttpServer())
        .patch(`/v1/zones/${created.body.id}/active`)
        .set(internal())
        .send({ active: false })
        .expect(200)
      expect(toggled.body.active).toBe(false)

      const missing = new Types.ObjectId().toString()
      const notFound = await request(app.getHttpServer())
        .patch(`/v1/zones/${missing}/active`)
        .set(internal())
        .send({ active: false })
        .expect(404)
      expect(notFound.body.code).toBe('ZONE_NOT_FOUND')

      const invalid = await request(app.getHttpServer())
        .patch(`/v1/zones/${created.body.id}/active`)
        .set(internal())
        .send({ active: 'false' })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')

      const after = await request(app.getHttpServer())
        .get(`/v1/zones/${created.body.id}`)
        .expect(200)
      expect(after.body.active).toBe(false)
    })
  })

  describe('Turnos /v1/shifts', () => {
    it('lista, obtiene por id, 404 SHIFT_NOT_FOUND, 201 con validación y 401 sin token', async () => {
      const list = await request(app.getHttpServer()).get('/v1/shifts').expect(200)
      expect(list.body).toEqual([])

      await request(app.getHttpServer())
        .post('/v1/shifts')
        .send({ name: 'Mañana', startTime: '08:00', endTime: '13:00' })
        .expect(401)

      const invalid = await request(app.getHttpServer())
        .post('/v1/shifts')
        .set(internal())
        .send({ name: 'Mañana', startTime: '08:00' })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')

      const created = await request(app.getHttpServer())
        .post('/v1/shifts')
        .set(internal())
        .send({ name: 'Mañana', startTime: '08:00', endTime: '13:00' })
        .expect(201)
      expect(created.body.startTime).toBe('08:00')

      const found = await request(app.getHttpServer())
        .get(`/v1/shifts/${created.body.id}`)
        .expect(200)
      expect(found.body.name).toBe('Mañana')

      const missing = new Types.ObjectId().toString()
      const notFound = await request(app.getHttpServer()).get(`/v1/shifts/${missing}`).expect(404)
      expect(notFound.body.code).toBe('SHIFT_NOT_FOUND')
    })

    it('activa/desactiva un turno, 404 y validación', async () => {
      const created = await request(app.getHttpServer())
        .post('/v1/shifts')
        .set(internal())
        .send({ name: 'Tarde', startTime: '13:00', endTime: '18:00' })
        .expect(201)

      const toggled = await request(app.getHttpServer())
        .patch(`/v1/shifts/${created.body.id}/active`)
        .set(internal())
        .send({ active: false })
        .expect(200)
      expect(toggled.body.active).toBe(false)

      const missing = new Types.ObjectId().toString()
      const notFound = await request(app.getHttpServer())
        .patch(`/v1/shifts/${missing}/active`)
        .set(internal())
        .send({ active: false })
        .expect(404)
      expect(notFound.body.code).toBe('SHIFT_NOT_FOUND')

      const invalid = await request(app.getHttpServer())
        .patch(`/v1/shifts/${created.body.id}/active`)
        .set(internal())
        .send({ active: 123 })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')

      const after = await request(app.getHttpServer())
        .get(`/v1/shifts/${created.body.id}`)
        .expect(200)
      expect(after.body.active).toBe(false)
    })
  })

  describe('POST /v1/seed (@Internal)', () => {
    it('crea el perfil del rider con token interno', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set(internal())
        .send({ userId: 'seed-1', firstName: 'Seed', lastName: 'Rider', phone: '555' })
        .expect(201)

      expect(res.body.summary.riders).toBe(1)
      expect(res.body.rider.userId).toBe('seed-1')

      const stored = await riderModel.findOne({ userId: 'seed-1' }).exec()
      expect(stored).not.toBeNull()
    })

    it('valida el body y exige token interno', async () => {
      await request(app.getHttpServer())
        .post('/v1/seed')
        .send({ userId: 'seed-2', firstName: 'Seed', lastName: 'Rider', phone: '555' })
        .expect(401)

      const invalid = await request(app.getHttpServer())
        .post('/v1/seed')
        .set(internal())
        .send({ userId: 'seed-2', firstName: 'Seed' })
        .expect(400)
      expect(invalid.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /health', () => {
    it('devuelve el contrato de salud', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200)

      expect(res.body.status).toBe('ok')
      expect(res.body.service).toBe('delivery')
      expect(typeof res.body.uptimeSeconds).toBe('number')
      expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false)
    })
  })

  describe('Ajustes de /v1/riders/me', () => {
    const seedRider = (): Promise<unknown> =>
      riderModel.create({
        userId: 'rider-me',
        firstName: 'Original',
        lastName: 'Apellido',
        phone: '111',
        vehicle: { type: 'moto' },
      })

    it('permite cambiar firstName/lastName', async () => {
      await seedRider()

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me')
        .set(bearer(riderToken('rider-me')))
        .send({ firstName: 'Nuevo', lastName: 'Cambiado' })
        .expect(200)

      expect(res.body.firstName).toBe('Nuevo')
      expect(res.body.lastName).toBe('Cambiado')
    })

    it('rechaza firstName/lastName vacíos con 400', async () => {
      await seedRider()

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me')
        .set(bearer(riderToken('rider-me')))
        .send({ firstName: '' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('acepta un body vacío sin cambios', async () => {
      await seedRider()

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me')
        .set(bearer(riderToken('rider-me')))
        .send({})
        .expect(200)

      expect(res.body.phone).toBe('111')
    })

    it('rechaza un vehículo con type inválido con 400', async () => {
      await seedRider()

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me/vehicle')
        .set(bearer(riderToken('rider-me')))
        .send({ type: 'avion' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('pasa a offline al desactivar la disponibilidad', async () => {
      await seedRider()

      await request(app.getHttpServer())
        .patch('/v1/riders/me/availability')
        .set(bearer(riderToken('rider-me')))
        .send({ online: true })
        .expect(200)

      const res = await request(app.getHttpServer())
        .patch('/v1/riders/me/availability')
        .set(bearer(riderToken('rider-me')))
        .send({ online: false })
        .expect(200)

      expect(res.body.status).toBe('offline')
      expect(res.body.available).toBe(false)
    })
  })
})
