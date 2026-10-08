import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { createMongoServer } from './mongo'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { HealthModule } from '../src/health/health.module'
import { SeedModule } from '../src/seed/seed.module'

interface UserRow {
  email: string
  role: string
  branchId: string | null
}

interface AddressRow {
  userId: string
  label: string
  latitude: number
  longitude: number
}

describe('Health & Seed (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let userModel: Model<UserRow>
  let addressModel: Model<AddressRow>

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), SecurityModule, HealthModule, SeedModule],
    }).compile()

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

    userModel = app.get<Model<UserRow>>(getModelToken('User'))
    addressModel = app.get<Model<AddressRow>>(getModelToken('Address'))
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /health', () => {
    it('expone el contrato {status, service, uptimeSeconds, timestamp} sin auth', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200)

      expect(res.body.status).toBe('ok')
      expect(res.body.service).toBe('auth')
      expect(typeof res.body.uptimeSeconds).toBe('number')
      expect(typeof res.body.timestamp).toBe('string')
      expect(Number.isNaN(Date.parse(res.body.timestamp as string))).toBe(false)
    })
  })

  describe('POST /v1/seed', () => {
    it('rechaza sin x-internal-token con 401', async () => {
      const res = await request(app.getHttpServer()).post('/v1/seed').send({}).expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('rechaza un x-internal-token inválido con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', 'token-incorrecto')
        .send({})
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('crea los usuarios base (sin branchId) sin branch_admin', async () => {
      await userModel.deleteMany({})

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({})
        .expect(201)

      expect(res.body.summary.users).toBe(3)
      const emails = res.body.users.map((u: { email: string }) => u.email)
      expect(emails).toEqual([
        'admin@foodbosco.local',
        'cliente@foodbosco.local',
        'repartidor@foodbosco.local',
      ])
      expect(await userModel.countDocuments({ role: 'branch_admin' })).toBe(0)
    })

    it('con branchId crea además el branch_admin con ese branchId', async () => {
      await userModel.deleteMany({})

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({ branchId: 'branch-7' })
        .expect(201)

      expect(res.body.summary.users).toBe(4)

      const branchAdmin = await userModel.findOne({ email: 'sucursal@foodbosco.local' })
      expect(branchAdmin).not.toBeNull()
      expect(branchAdmin?.role).toBe('branch_admin')
      expect(branchAdmin?.branchId).toBe('branch-7')
    })

    it('con branches crea un branch_admin por sucursal', async () => {
      await userModel.deleteMany({})

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({
          branches: [
            { id: 'b-centro', name: 'Centro' },
            { id: 'b-norte', name: 'Norte' },
            { id: 'b-oeste', name: 'Oeste' },
          ],
        })
        .expect(201)

      expect(res.body.summary.users).toBe(6)

      const admins = await userModel.find({ role: 'branch_admin' }).sort({ email: 1 })
      expect(admins.map((admin) => ({ email: admin.email, branchId: admin.branchId }))).toEqual([
        { email: 'sucursal.centro@foodbosco.local', branchId: 'b-centro' },
        { email: 'sucursal.norte@foodbosco.local', branchId: 'b-norte' },
        { email: 'sucursal.oeste@foodbosco.local', branchId: 'b-oeste' },
      ])
    })

    it('siembra dos direcciones para el customer', async () => {
      await userModel.deleteMany({})
      await addressModel.deleteMany({})

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({})
        .expect(201)

      expect(res.body.summary.addresses).toBe(2)

      const customer = await userModel.findOne({ email: 'cliente@foodbosco.local' })
      expect(await addressModel.countDocuments({ userId: customer?._id.toString() })).toBe(2)
    })

    // Decisión del equipo: POST /v1/seed es intencionalmente accesible. Sólo declara
    // @Internal() (sin @Roles); el guard corta por x-internal-token cuando coincide y,
    // si no, acepta cualquier JWT válido. Que un customer pueda ejecutar el seed es el
    // comportamiento esperado (no se restringe por rol).
    it('acepta un JWT de customer: el seed es intencionalmente accesible', async () => {
      const customerJwt = jwt.sign(
        { sub: 'customer-1', userId: 'customer-1', roles: ['customer'], branchId: null },
        env.jwtSecret,
        { expiresIn: '5m' },
      )

      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('Authorization', `Bearer ${customerJwt}`)
        .send({})
        .expect(201)

      expect(res.body.summary.users).toBeGreaterThan(0)
    })
  })
})
