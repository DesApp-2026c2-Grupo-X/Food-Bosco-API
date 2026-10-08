import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Types } from 'mongoose'
import request from 'supertest'
import { createMongoServer } from './mongo'
import type { App } from 'supertest/types'
import { BranchModule } from '../src/branch/branch.module'
import { CartModule } from '../src/cart/cart.module'
import { CategoryModule } from '../src/category/category.module'
import { env } from '../src/config/env'
import { HttpExceptionFilter } from '../src/config/exceptions/http-exception.filter'
import { SecurityModule } from '../src/config/security/security.module'
import { IngredientModule } from '../src/ingredient/ingredient.module'
import { OrderModule } from '../src/order/order.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { StockModule } from '../src/stock/stock.module'

const DAYS = [0, 1, 2, 3, 4, 5, 6]

const openHours = DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  opening: '00:00',
  closing: '23:59',
  closed: false,
}))

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)

const customerToken = (id: string): string =>
  jwt.sign({ userId: id, roles: ['customer'] }, env.jwtSecret)

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
}

describe('Commerce — visibilidad y 404 de pedidos/producto (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let ownerOrderId = ''
  let unknownOrderId = ''
  let unknownProductId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    mongod = await createMongoServer()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        SecurityModule,
        CategoryModule,
        ProductModule,
        IngredientModule,
        BranchModule,
        CartModule,
        OrderModule,
        StockModule,
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

    const category = await http()
      .post('/v1/catalog/categories')
      .set(...auth(superToken))
      .send({ name: 'Hamburguesas' })
      .expect(201)

    const ingredient = await http()
      .post('/v1/catalog/ingredients')
      .set(...auth(superToken))
      .send({ name: 'Medallón', unit: 'un' })
      .expect(201)

    const branch = await http()
      .post('/v1/branches')
      .set(...auth(superToken))
      .send({ name: 'Centro', addressText: 'Av 1', latitude: 0, longitude: 0 })
      .expect(201)
    const branchId = branch.body.id as string

    await http()
      .put(`/v1/branches/${branchId}/hours`)
      .set(...auth(superToken))
      .send({ hours: openHours })
      .expect(200)

    await http()
      .post('/v1/stock/adjustments')
      .set(...auth(superToken))
      .send({ branchId, ingredientId: ingredient.body.id, delta: 1000 })
      .expect(201)

    const product = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId: category.body.id, name: 'Hamburguesa', description: 'Rica', price: 100 })
      .expect(201)

    await http()
      .put(`/v1/catalog/products/${product.body.id}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId: ingredient.body.id, quantity: 1 }] })
      .expect(200)

    const owner = customerToken('cust-owner')
    await http()
      .post('/v1/carts/items')
      .set(...auth(owner))
      .send({ productId: product.body.id, quantity: 1 })
      .expect(201)

    const created = await http()
      .post('/v1/orders')
      .set(...auth(owner))
      .send(deliveryAddress)
      .expect(201)
    ownerOrderId = created.body.id as string

    unknownOrderId = new Types.ObjectId().toString()
    unknownProductId = new Types.ObjectId().toString()
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/orders/:orderId/history — 404 faltantes', () => {
    it('pedido inexistente → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/orders/${unknownOrderId}/history`)
        .set(...auth(superToken))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })

    it('pedido ajeno → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/orders/${ownerOrderId}/history`)
        .set(...auth(customerToken('cust-stranger-history')))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })
  })

  describe('GET /v1/orders/:orderId/transitions — 404 faltante', () => {
    it('pedido ajeno → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/orders/${ownerOrderId}/transitions`)
        .set(...auth(customerToken('cust-stranger-transitions')))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })
  })

  describe('PATCH /v1/orders/:orderId/status — 404 faltante', () => {
    it('pedido inexistente → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .patch(`/v1/orders/${unknownOrderId}/status`)
        .set(...auth(superToken))
        .send({ status: 'confirmed' })
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })
  })

  describe('POST /v1/catalog/products/:productId/configurations — 404 faltante', () => {
    it('producto inexistente → 404 PRODUCT_NOT_FOUND', async () => {
      const res = await http()
        .post(`/v1/catalog/products/${unknownProductId}/configurations`)
        .set(...auth(superToken))
        .send({ name: 'Tamaño', type: 'single', required: false })
        .expect(404)

      expect(res.body.code).toBe('PRODUCT_NOT_FOUND')
    })
  })
})
