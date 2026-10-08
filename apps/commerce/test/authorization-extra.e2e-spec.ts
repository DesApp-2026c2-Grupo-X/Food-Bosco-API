import { INestApplication, ValidationPipe } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import { MongoMemoryServer } from 'mongodb-memory-server'
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
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

const deliveryAddress = {
  addressId: 'addr-1',
  deliveryAddress: { text: 'Av Cliente', latitude: 0.0001, longitude: 0 },
}

interface StockRow {
  ingredientId: string
  branchId: string
  quantity: number
}

// Sub-casos de autorización pendientes: 401 sin token en endpoints protegidos que
// no aparecen en la matriz de `authorization.e2e-spec.ts` ni en los demás suites.
// Además del status se verifica ausencia de efecto secundario en las mutaciones.
describe('Commerce — autorización extra: 401 sin token (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  const BRANCH_NAME = 'Centro'
  let branchId = ''
  let ingredientId = ''
  let orderId = ''

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]
  const http = () => request(app.getHttpServer())

  const stockQuantity = async (): Promise<number> => {
    const res = await http()
      .get(`/v1/stock?branchId=${branchId}`)
      .set(...auth(superToken))
      .expect(200)

    const row = (res.body as StockRow[]).find((entry) => entry.ingredientId === ingredientId)
    return row?.quantity ?? 0
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
    ingredientId = ingredient.body.id as string

    const branch = await http()
      .post('/v1/branches')
      .set(...auth(superToken))
      .send({ name: BRANCH_NAME, addressText: 'Av 1', latitude: 0, longitude: 0 })
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
      .send({ branchId, ingredientId, delta: 10 })
      .expect(201)

    const product = await http()
      .post('/v1/catalog/products')
      .set(...auth(superToken))
      .send({ categoryId: category.body.id, name: 'Hamburguesa', description: 'Rica', price: 100 })
      .expect(201)

    await http()
      .put(`/v1/catalog/products/${product.body.id}/recipe`)
      .set(...auth(superToken))
      .send({ items: [{ ingredientId, quantity: 1 }] })
      .expect(200)

    await http()
      .post('/v1/carts/items')
      .set(...auth(customerToken))
      .send({ productId: product.body.id, quantity: 1 })
      .expect(201)

    const created = await http()
      .post('/v1/orders')
      .set(...auth(customerToken))
      .send(deliveryAddress)
      .expect(201)
    orderId = created.body.id as string
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  it('PATCH /v1/branches/:branchId sin token → 401 UNAUTHENTICATED y no modifica la sucursal', async () => {
    const before = await http().get(`/v1/branches/${branchId}`).expect(200)
    expect(before.body.name).toBe(BRANCH_NAME)

    const res = await http()
      .patch(`/v1/branches/${branchId}`)
      .send({ name: 'Hackeada' })
      .expect(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')

    const after = await http().get(`/v1/branches/${branchId}`).expect(200)
    expect(after.body.name).toBe(BRANCH_NAME)
  })

  it('GET /v1/orders/:orderId/history sin token → 401 UNAUTHENTICATED', async () => {
    const res = await http().get(`/v1/orders/${orderId}/history`).expect(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')
  })

  it('POST /v1/stock/adjustments sin token → 401 UNAUTHENTICATED y no altera el stock', async () => {
    const before = await stockQuantity()

    const res = await http()
      .post('/v1/stock/adjustments')
      .send({ branchId, ingredientId, delta: 1000 })
      .expect(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')

    const after = await stockQuantity()
    expect(after).toBe(before)
  })
})
