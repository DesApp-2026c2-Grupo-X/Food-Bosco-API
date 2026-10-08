import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import mongoose, { Connection } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { createMongoServer } from './mongo'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { HealthModule } from '../src/health/health.module'
import { SeedModule } from '../src/seed/seed.module'

const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

describe('Commerce — health & seed E2E', () => {
  let mongod: MongoMemoryServer
  let connection: Connection
  let app: INestApplication<App>

  beforeAll(async () => {
    mongod = await createMongoServer()
    connection = await mongoose.createConnection(mongod.getUri()).asPromise()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SecurityModule, HealthModule, SeedModule],
    })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
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
  })

  afterAll(async () => {
    await app.close()
    await connection.close()
    await mongod.stop()
  })

  describe('GET /health', () => {
    it('expone el contrato sin autenticación', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200)

      expect(res.body.status).toBe('ok')
      expect(res.body.service).toBe('commerce')
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

    it('rechaza un x-internal-token incorrecto con 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', 'token-incorrecto')
        .send({})
        .expect(401)

      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('con token interno válido crea el dataset y devuelve el resumen', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({})
        .expect(201)

      expect(res.body).toMatchObject({
        summary: {
          categories: 5,
          ingredients: 19,
          products: 17,
          branches: 3,
          promotions: 2,
          stockRows: 57,
          orderStates: 7,
          parameters: 3,
        },
      })
      expect(res.body.branches).toHaveLength(3)
    })

    it('con contexto de pedido siembra los pedidos demo en distintos estados', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('x-internal-token', env.internalApiToken)
        .send({
          order: {
            clientId: 'seed-client',
            address: {
              id: 'seed-address',
              text: 'Av. Vergara 1250, Hurlingham',
              latitude: -34.589,
              longitude: -58.636,
            },
          },
        })
        .expect(201)

      expect(res.body.summary.orders).toBe(5)
      expect(res.body.orders).toHaveLength(5)
      expect((res.body.orders as { status: string }[]).map((order) => order.status).sort()).toEqual(
        ['cancelled', 'delivered', 'on_the_way', 'pending', 'ready_for_delivery'],
      )
    })

    // Intencional: `POST /v1/seed` sólo declara @Internal() (sin @Roles). Si el header
    // interno no coincide, el guard cae al flujo JWT y, al no haber roles requeridos,
    // acepta cualquier JWT válido (p. ej. un customer). El seed es una utilidad interna
    // idempotente de datos de prueba, no una operación privilegiada de negocio.
    it('acepta un JWT de customer porque el seed no exige roles (comportamiento intencional)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/seed')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({})
        .expect(201)

      expect(res.body.summary.orderStates).toBe(7)
    })
  })
})
