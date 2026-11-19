import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test } from '@nestjs/testing'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import type { App } from 'supertest/types'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { TariffModule } from '../src/tariff/tariff.module'
import { TariffService } from '../src/tariff/tariff.service'
import { createMongoServer } from './mongo'

const internalHeaders = { 'x-internal-token': env.internalApiToken }

describe('Delivery tariffs (e2e)', () => {
  let mongod: MongoMemoryServer
  let database = 0

  const createApp = async (): Promise<INestApplication<App>> => {
    database += 1
    const moduleFixture = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri(`delivery-tariffs-${database}`)),
        SecurityModule,
        TariffModule,
      ],
    }).compile()

    const app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    return app
  }

  beforeAll(async () => {
    mongod = await createMongoServer()
  })

  afterAll(async () => {
    await mongod.stop()
  })

  it('crea la tarifa inicial activa al arrancar con la colección vacía', async () => {
    const app = await createApp()

    try {
      const active = await request(app.getHttpServer())
        .get('/v1/tariffs/active')
        .set(internalHeaders)
        .expect(200)

      expect(active.body).toMatchObject({
        baseFare: 500,
        perKm: 200,
        perOrder: 300,
        currency: 'ARS',
        active: true,
        createdBy: 'system:bootstrap',
      })

      const history = await request(app.getHttpServer())
        .get('/v1/tariffs')
        .set(internalHeaders)
        .expect(200)

      expect(history.body).toHaveLength(1)
    } finally {
      await app.close()
    }
  })

  it('es idempotente: correr el seed dos veces no duplica ni modifica la tarifa', async () => {
    const app = await createApp()

    try {
      const service = app.get(TariffService)
      await service.ensureBootstrap()
      await service.ensureBootstrap()

      const history = await request(app.getHttpServer())
        .get('/v1/tariffs')
        .set(internalHeaders)
        .expect(200)

      expect(history.body).toHaveLength(1)
      expect(history.body[0]).toMatchObject({
        baseFare: 500,
        perKm: 200,
        perOrder: 300,
        createdBy: 'system:bootstrap',
      })
    } finally {
      await app.close()
    }
  })

  it('publicar desactiva la anterior y conserva ambas versiones con su autor', async () => {
    const app = await createApp()

    try {
      const published = await request(app.getHttpServer())
        .post('/v1/tariffs')
        .set(internalHeaders)
        .send({
          baseFare: 700,
          perKm: 250,
          perOrder: 350,
          currency: 'ARS',
          createdBy: 'admin-1',
        })
        .expect(201)

      expect(published.body).toMatchObject({
        baseFare: 700,
        perKm: 250,
        perOrder: 350,
        active: true,
        createdBy: 'admin-1',
      })

      const active = await request(app.getHttpServer())
        .get('/v1/tariffs/active')
        .set(internalHeaders)
        .expect(200)

      expect(active.body.id).toBe(published.body.id)
      expect(active.body.baseFare).toBe(700)

      const history = await request(app.getHttpServer())
        .get('/v1/tariffs')
        .set(internalHeaders)
        .expect(200)

      expect(history.body).toHaveLength(2)
      expect(history.body.filter((tariff: { active: boolean }) => tariff.active)).toHaveLength(1)
      expect(history.body.map((tariff: { createdBy: string }) => tariff.createdBy)).toEqual(
        expect.arrayContaining(['admin-1', 'system:bootstrap']),
      )
    } finally {
      await app.close()
    }
  })

  it('mantiene una sola tarifa activa ante publicaciones concurrentes', async () => {
    const app = await createApp()

    try {
      const service = app.get(TariffService)
      await Promise.allSettled([
        service.publish({ baseFare: 800, perKm: 300, perOrder: 400, createdBy: 'admin-1' }),
        service.publish({ baseFare: 900, perKm: 350, perOrder: 450, createdBy: 'admin-2' }),
      ])

      const history = await request(app.getHttpServer())
        .get('/v1/tariffs')
        .set(internalHeaders)
        .expect(200)

      expect(history.body.filter((tariff: { active: boolean }) => tariff.active)).toHaveLength(1)
    } finally {
      await app.close()
    }
  })

  it('rechaza publicar sin token interno', async () => {
    const app = await createApp()

    try {
      await request(app.getHttpServer())
        .post('/v1/tariffs')
        .send({
          baseFare: 800,
          perKm: 300,
          perOrder: 400,
          currency: 'ARS',
          createdBy: 'admin-1',
        })
        .expect(401)
    } finally {
      await app.close()
    }
  })
})
