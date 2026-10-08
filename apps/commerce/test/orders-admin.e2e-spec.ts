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
import { UploadModule } from '../src/upload/upload.module'
import { UploadRepository } from '../src/upload/upload.repository'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

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

const branchAdminTokenFor = (branchId: string, userId = 'branch-1'): string =>
  jwt.sign({ userId, roles: ['branch_admin'], branchId }, env.jwtSecret)

const branchAdminWithoutBranch = jwt.sign(
  { userId: 'branch-no-id', roles: ['branch_admin'] },
  env.jwtSecret,
)

const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
}

interface OrderBody {
  id: string
  number: string
  branchId: string
  status: string
}

describe('Commerce Service — pedidos: ramas admin y permisos (e2e, RQ-ORD)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  let branchId = ''
  let productId = ''
  let unknownOrderId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const createOrder = async (customerId: string): Promise<OrderBody> => {
    const token = customerToken(customerId)
    await http()
      .post('/v1/carts/items')
      .set(...auth(token))
      .send({ productId, quantity: 1 })
      .expect(201)

    const created = await http()
      .post('/v1/orders')
      .set(...auth(token))
      .send(deliveryAddress)
      .expect(201)

    return created.body as OrderBody
  }

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
        UploadModule,
      ],
    })
      .overrideProvider(UploadRepository)
      .useValue({ upload: jest.fn().mockResolvedValue({ url: CLOUDINARY_URL }) })
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
    branchId = branch.body.id as string

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
    productId = product.body.id as string

    await http()
      .put(`/v1/catalog/products/${productId}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId: ingredient.body.id, quantity: 1 }] })
      .expect(200)

    unknownOrderId = new Types.ObjectId().toString()
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  describe('GET /v1/orders — ramas por rol, filtros y paginación', () => {
    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get('/v1/orders').expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it('rider → 403 FORBIDDEN', async () => {
      const res = await http()
        .get('/v1/orders')
        .set(...auth(riderToken))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('branch_admin sin branchId en el token → 403 FORBIDDEN', async () => {
      const res = await http()
        .get('/v1/orders')
        .set(...auth(branchAdminWithoutBranch))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN')
    })

    it('branch_admin lista sólo los pedidos de su sucursal e ignora query.branchId', async () => {
      await createOrder('cust-branch-list-a')
      await createOrder('cust-branch-list-b')

      const res = await http()
        .get('/v1/orders?branchId=otra-sucursal')
        .set(...auth(branchAdminTokenFor(branchId)))
        .expect(200)

      const data = res.body.data as Array<{ branchId: string }>
      expect(data.length).toBeGreaterThanOrEqual(2)
      expect(data.every((order) => order.branchId === branchId)).toBe(true)
    })

    it('branch_admin de otra sucursal no ve los pedidos de esta sucursal', async () => {
      const res = await http()
        .get('/v1/orders')
        .set(...auth(branchAdminTokenFor('otra-sucursal', 'branch-9')))
        .expect(200)

      expect(res.body.data).toHaveLength(0)
    })

    it('super_admin filtra por branchId y status', async () => {
      const confirmedOrder = await createOrder('cust-filter-confirmed')
      await http()
        .patch(`/v1/orders/${confirmedOrder.id}/status`)
        .set(...auth(branchAdminTokenFor(branchId)))
        .send({ status: 'confirmed' })
        .expect(200)
      await createOrder('cust-filter-pending')

      const pendingRes = await http()
        .get(`/v1/orders?branchId=${branchId}&status=pending`)
        .set(...auth(superToken))
        .expect(200)
      const pending = pendingRes.body.data as Array<{ branchId: string; status: string }>
      expect(pending.length).toBeGreaterThanOrEqual(1)
      expect(
        pending.every((order) => order.branchId === branchId && order.status === 'pending'),
      ).toBe(true)

      const confirmedRes = await http()
        .get(`/v1/orders?branchId=${branchId}&status=confirmed`)
        .set(...auth(superToken))
        .expect(200)
      const confirmed = confirmedRes.body.data as Array<{
        id: string
        branchId: string
        status: string
      }>
      expect(confirmed.map((order) => order.id)).toContain(confirmedOrder.id)
      expect(
        confirmed.every((order) => order.branchId === branchId && order.status === 'confirmed'),
      ).toBe(true)
    })

    it('super_admin busca por número y pagina con limit/offset', async () => {
      const searchOrder = await createOrder('cust-search-number')

      const byNumber = await http()
        .get(`/v1/orders?search=${searchOrder.number}`)
        .set(...auth(superToken))
        .expect(200)
      expect(byNumber.body.data).toHaveLength(1)
      expect(byNumber.body.data[0].id).toBe(searchOrder.id)

      await createOrder('cust-page-a')
      await new Promise((resolve) => setTimeout(resolve, 5))
      await createOrder('cust-page-b')

      const page1 = await http()
        .get('/v1/orders?limit=1&offset=0')
        .set(...auth(superToken))
        .expect(200)
      const page2 = await http()
        .get('/v1/orders?limit=1&offset=1')
        .set(...auth(superToken))
        .expect(200)

      expect(page1.body.meta).toMatchObject({ limit: 1, offset: 0 })
      expect(page2.body.meta).toMatchObject({ limit: 1, offset: 1 })
      expect(page1.body.data).toHaveLength(1)
      expect(page2.body.data).toHaveLength(1)
      expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id)
    })
  })

  describe('GET /v1/orders/:orderId — visibilidad por rol', () => {
    it('dueño customer → 200', async () => {
      const order = await createOrder('cust-view-owner')
      const res = await http()
        .get(`/v1/orders/${order.id}`)
        .set(...auth(customerToken('cust-view-owner')))
        .expect(200)

      expect(res.body.id).toBe(order.id)
    })

    it('branch_admin de la sucursal → 200', async () => {
      const order = await createOrder('cust-view-branch')
      const res = await http()
        .get(`/v1/orders/${order.id}`)
        .set(...auth(branchAdminTokenFor(branchId)))
        .expect(200)

      expect(res.body.branchId).toBe(branchId)
    })

    it('super_admin → 200', async () => {
      const order = await createOrder('cust-view-super')
      const res = await http()
        .get(`/v1/orders/${order.id}`)
        .set(...auth(superToken))
        .expect(200)

      expect(res.body.id).toBe(order.id)
    })

    it('customer ajeno → 404 ORDER_NOT_FOUND', async () => {
      const order = await createOrder('cust-view-real-owner')
      const res = await http()
        .get(`/v1/orders/${order.id}`)
        .set(...auth(customerToken('cust-view-stranger')))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })

    it('orderId inexistente → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/orders/${unknownOrderId}`)
        .set(...auth(superToken))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })

    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get(`/v1/orders/${unknownOrderId}`).expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('GET /v1/orders/:orderId/transitions', () => {
    it('devuelve las transiciones disponibles según el estado', async () => {
      const token = customerToken('cust-transitions')
      const order = await createOrder('cust-transitions')

      const pending = await http()
        .get(`/v1/orders/${order.id}/transitions`)
        .set(...auth(token))
        .expect(200)
      expect(pending.body).toEqual(['confirmed', 'cancelled'])

      await http()
        .patch(`/v1/orders/${order.id}/status`)
        .set(...auth(branchAdminTokenFor(branchId)))
        .send({ status: 'confirmed' })
        .expect(200)

      const confirmed = await http()
        .get(`/v1/orders/${order.id}/transitions`)
        .set(...auth(superToken))
        .expect(200)
      expect(confirmed.body).toEqual(['preparing', 'cancelled'])
    })

    it('orderId inexistente → 404 ORDER_NOT_FOUND', async () => {
      const res = await http()
        .get(`/v1/orders/${unknownOrderId}/transitions`)
        .set(...auth(superToken))
        .expect(404)

      expect(res.body.code).toBe('ORDER_NOT_FOUND')
    })

    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().get(`/v1/orders/${unknownOrderId}/transitions`).expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('POST /v1/orders/:orderId/repeat — autorización', () => {
    it.each([
      {
        name: 'branch_admin',
        token: branchAdminTokenFor(branchId),
        customer: 'cust-repeat-branch',
      },
      { name: 'rider', token: riderToken, customer: 'cust-repeat-rider' },
    ])('$name → 403 FORBIDDEN', async ({ token, customer }) => {
      const order = await createOrder(customer)
      const res = await http()
        .post(`/v1/orders/${order.id}/repeat`)
        .set(...auth(token))
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })

  describe('POST /v1/orders — autorización', () => {
    it('sin token → 401 UNAUTHENTICATED', async () => {
      const res = await http().post('/v1/orders').send(deliveryAddress).expect(401)
      expect(res.body.code).toBe('UNAUTHENTICATED')
    })

    it.each([
      { name: 'branch_admin', token: branchAdminTokenFor(branchId) },
      { name: 'rider', token: riderToken },
    ])('$name → 403 FORBIDDEN', async ({ token }) => {
      const res = await http()
        .post('/v1/orders')
        .set(...auth(token))
        .send(deliveryAddress)
        .expect(403)

      expect(res.body.code).toBe('FORBIDDEN')
    })
  })
})
