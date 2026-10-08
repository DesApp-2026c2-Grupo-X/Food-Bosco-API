import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken, MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { Model } from 'mongoose'
import request from 'supertest'
import type { App } from 'supertest/types'
import { createMongoServer } from './mongo'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { OrderState, OrderStateDocument } from '../src/order-state/order-state.model'
import { OrderStateModule } from '../src/order-state/order-state.module'
import { ParameterModule } from '../src/parameter/parameter.module'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const branchAdminToken = jwt.sign(
  { userId: 'branch-1', roles: ['branch_admin'], branchId: 'branch-1' },
  env.jwtSecret,
)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]

describe('Commerce — config E2E (order-states, parameters)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>
  let orderStateModel: Model<OrderStateDocument>

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        OrderStateModule,
        ParameterModule,
      ],
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

    orderStateModel = app.get<Model<OrderStateDocument>>(getModelToken(OrderState.name))
    await orderStateModel.init()
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/config/order-states', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/config/order-states').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('lista los estados para cualquier usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/config/order-states')
        .set(...auth(customerToken))
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toEqual([])
    })
  })

  describe('POST /v1/config/order-states', () => {
    it('crea un estado como super_admin con 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/config/order-states')
        .set(...auth(superToken))
        .send({ code: 'pending', name: 'Pendiente', order: 0 })
        .expect(201)

      expect(res.body).toEqual({
        code: 'pending',
        name: 'Pendiente',
        order: 0,
        active: true,
      })
    })

    it.each([
      { name: 'branch_admin', token: branchAdminToken },
      { name: 'customer', token: customerToken },
    ])('rechaza a un $name con 403', async ({ token }) => {
      const res = await request(app.getHttpServer())
        .post('/v1/config/order-states')
        .set(...auth(token))
        .send({ code: 'forbidden-state', name: 'X', order: 9 })
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })

    it.each([
      { body: { name: 'Sin código', order: 1 }, case: 'sin code' },
      { body: { code: '', name: 'Vacío', order: 1 }, case: 'code vacío' },
      { body: { code: 'sin-nombre', order: 1 }, case: 'sin name' },
      { body: { code: 'order-invalido', name: 'X', order: 'no-numero' }, case: 'order inválido' },
    ])('rechaza payload inválido ($case) con 400', async ({ body }) => {
      const res = await request(app.getHttpServer())
        .post('/v1/config/order-states')
        .set(...auth(superToken))
        .send(body)
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    // INT-08: un `code` duplicado dispara E11000; el repositorio lo traduce a un error
    // de dominio 409 en lugar de filtrar un 500.
    it('un code duplicado responde 409 ORDER_STATE_ALREADY_EXISTS', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/config/order-states')
        .set(...auth(superToken))
        .send({ code: 'pending', name: 'Duplicado', order: 0 })
        .expect(409)

      expect(res.body.code).toBe('ORDER_STATE_ALREADY_EXISTS')
    })
  })

  describe('PUT /v1/config/order-states/:code', () => {
    it('actualiza nombre y orden existentes con 200', async () => {
      const res = await request(app.getHttpServer())
        .put('/v1/config/order-states/pending')
        .set(...auth(superToken))
        .send({ name: 'Pendiente editado', order: 5 })
        .expect(200)

      expect(res.body).toEqual({
        code: 'pending',
        name: 'Pendiente editado',
        order: 5,
        active: true,
      })
    })

    it('rechaza un nombre vacío con 400', async () => {
      const res = await request(app.getHttpServer())
        .put('/v1/config/order-states/pending')
        .set(...auth(superToken))
        .send({ name: '' })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('responde 404 ORDER_STATE_NOT_FOUND para un code inexistente', async () => {
      const res = await request(app.getHttpServer())
        .put('/v1/config/order-states/inexistente')
        .set(...auth(superToken))
        .send({ name: 'X' })
        .expect(404)

      expect(res.body.code).toBe('ORDER_STATE_NOT_FOUND')
    })
  })

  describe('PATCH /v1/config/order-states/:code/active', () => {
    it('desactiva y reactiva un estado', async () => {
      const deactivated = await request(app.getHttpServer())
        .patch('/v1/config/order-states/pending/active')
        .set(...auth(superToken))
        .send({ active: false })
        .expect(200)

      expect(deactivated.body.active).toBe(false)

      const activated = await request(app.getHttpServer())
        .patch('/v1/config/order-states/pending/active')
        .set(...auth(superToken))
        .send({ active: true })
        .expect(200)

      expect(activated.body.active).toBe(true)
    })

    it('responde 404 ORDER_STATE_NOT_FOUND para un code inexistente', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/config/order-states/inexistente/active')
        .set(...auth(superToken))
        .send({ active: true })
        .expect(404)

      expect(res.body.code).toBe('ORDER_STATE_NOT_FOUND')
    })

    it.each([
      { name: 'nulo', active: null },
      { name: 'string "false"', active: 'false' },
      { name: 'string "true"', active: 'true' },
      { name: 'numérico 123', active: 123 },
    ])('rechaza un active inválido ($name) con 400 (INT-03)', async ({ active }) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/config/order-states/pending/active')
        .set(...auth(superToken))
        .send({ active })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /v1/config/parameters', () => {
    it('rechaza sin token con 401', async () => {
      const res = await request(app.getHttpServer()).get('/v1/config/parameters').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'customer', token: customerToken },
      { name: 'branch_admin', token: branchAdminToken },
    ])('rechaza a un $name con 403', async ({ token }) => {
      const res = await request(app.getHttpServer())
        .get('/v1/config/parameters')
        .set(...auth(token))
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('lista los parámetros para super_admin', async () => {
      await request(app.getHttpServer())
        .get('/v1/config/parameters')
        .set(...auth(superToken))
        .expect(200)

      const parameterModel = app.get(getModelToken('Parameter')) as Model<unknown>
      await parameterModel.create({ key: 'MAX_DISTANCE_KM', value: 10, unit: 'km' })

      const res = await request(app.getHttpServer())
        .get('/v1/config/parameters')
        .set(...auth(superToken))
        .expect(200)

      expect(res.body).toEqual([{ key: 'MAX_DISTANCE_KM', value: 10, unit: 'km' }])
    })
  })

  describe('PATCH /v1/config/parameters/:key', () => {
    it('actualiza el valor de un parámetro existente', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/config/parameters/MAX_DISTANCE_KM')
        .set(...auth(superToken))
        .send({ value: 25 })
        .expect(200)

      expect(res.body).toEqual({ key: 'MAX_DISTANCE_KM', value: 25, unit: 'km' })
    })

    it('responde 404 PARAMETER_NOT_FOUND para una key inexistente', async () => {
      const res = await request(app.getHttpServer())
        .patch('/v1/config/parameters/NO_EXISTE')
        .set(...auth(superToken))
        .send({ value: 5 })
        .expect(404)

      expect(res.body.code).toBe('PARAMETER_NOT_FOUND')
    })

    it.each([
      { value: -1, case: 'valor negativo' },
      { value: 0, case: 'valor cero' },
      { value: 'no-numero', case: 'valor no numérico' },
    ])('rechaza $case con 400', async ({ value }) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/config/parameters/MAX_DISTANCE_KM')
        .set(...auth(superToken))
        .send({ value })
        .expect(400)

      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  // NEW-25 (gap de contrato, sin implementar): RQ-CFG-08 / G-15 y la tabla §7.7 sólo
  // definen `GET /v1/config/parameters` y `PATCH /v1/config/parameters/{key}`. El
  // contrato NO define un `POST` de alta; los parámetros se crean únicamente por seed.
  // Se documenta el gap en lugar de inventar un endpoint fuera de contrato.
  describe('POST /v1/config/parameters — gap sin implementar (NEW-25)', () => {
    it('no expone alta de parámetros → 404', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/config/parameters')
        .set(...auth(superToken))
        .send({ key: 'NUEVO_PARAMETRO', value: 1, unit: 'u' })
        .expect(404)

      expect(res.body.code).toBe('NOT_FOUND')
    })
  })
})
