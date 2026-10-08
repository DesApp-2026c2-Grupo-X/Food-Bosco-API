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
import { OrderStateModule } from '../src/order-state/order-state.module'
import { ParameterModule } from '../src/parameter/parameter.module'
import { ProductModule } from '../src/product/product.module'
import { PromotionModule } from '../src/promotion/promotion.module'
import { StockModule } from '../src/stock/stock.module'
import { UploadModule } from '../src/upload/upload.module'
import { UploadRepository } from '../src/upload/upload.repository'

const MISSING_ID = '000000000000000000000000'
const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)
const riderToken = jwt.sign({ userId: 'rider-1', roles: ['rider'] }, env.jwtSecret)

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface AuthorizationCase {
  name: string
  method: HttpMethod
  path: string
  forbiddenRole: string
  forbiddenToken: string
  body?: Record<string, unknown>
}

// Matriz de endpoints protegidos aún sin caso de autorización. Cada fila verifica
// 401 sin token y 403 con un rol deliberadamente incorrecto y no cubierto por los
// suites existentes (rider para endpoints de admin, super_admin para rutas de customer).
const CASES: AuthorizationCase[] = [
  // Mutaciones de catálogo
  {
    name: 'POST /v1/catalog/categories',
    method: 'post',
    path: '/v1/catalog/categories',
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/products',
    method: 'post',
    path: '/v1/catalog/products',
    body: { categoryId: 'c', name: 'X', description: 'D', price: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/products/:id',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}`,
    body: { price: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/products/:id/available',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/available`,
    body: { available: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/ingredients',
    method: 'post',
    path: '/v1/catalog/ingredients',
    body: { name: 'X', unit: 'un' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'GET /v1/catalog/ingredients',
    method: 'get',
    path: '/v1/catalog/ingredients',
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}`,
    body: { unit: 'kg' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id/active',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}/active`,
    body: { active: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/categories/:id',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}`,
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/categories/:id/active',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}/active`,
    body: { active: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Subrutas admin de configuración y receta de producto
  {
    name: 'GET /v1/catalog/products/:id/configurations',
    method: 'get',
    path: `/v1/catalog/products/${MISSING_ID}/configurations`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/products/:id/configurations',
    method: 'post',
    path: `/v1/catalog/products/${MISSING_ID}/configurations`,
    body: { name: 'X', type: 'single', required: false },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/products/:id/configurations/:gid',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/configurations/${MISSING_ID}`,
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'DELETE /v1/catalog/products/:id/configurations/:gid',
    method: 'delete',
    path: `/v1/catalog/products/${MISSING_ID}/configurations/${MISSING_ID}`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/products/:id/configurations/:gid/options',
    method: 'post',
    path: `/v1/catalog/products/${MISSING_ID}/configurations/${MISSING_ID}/options`,
    body: { name: 'X', extraPrice: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/products/:id/configurations/:gid/options/:oid',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/configurations/${MISSING_ID}/options/${MISSING_ID}`,
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'DELETE /v1/catalog/products/:id/configurations/:gid/options/:oid',
    method: 'delete',
    path: `/v1/catalog/products/${MISSING_ID}/configurations/${MISSING_ID}/options/${MISSING_ID}`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'GET /v1/catalog/products/:id/recipe',
    method: 'get',
    path: `/v1/catalog/products/${MISSING_ID}/recipe`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PUT /v1/catalog/products/:id/recipe',
    method: 'put',
    path: `/v1/catalog/products/${MISSING_ID}/recipe`,
    body: { items: [{ ingredientId: MISSING_ID, quantity: 1 }] },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/products/:id/recipe/items',
    method: 'post',
    path: `/v1/catalog/products/${MISSING_ID}/recipe/items`,
    body: { ingredientId: MISSING_ID, quantity: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/products/:id/recipe/items/:itemId',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/recipe/items/${MISSING_ID}`,
    body: { ingredientId: MISSING_ID, quantity: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'DELETE /v1/catalog/products/:id/recipe/items/:itemId',
    method: 'delete',
    path: `/v1/catalog/products/${MISSING_ID}/recipe/items/${MISSING_ID}`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Promociones (5 endpoints)
  {
    name: 'GET /v1/catalog/promotions',
    method: 'get',
    path: '/v1/catalog/promotions',
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/catalog/promotions',
    method: 'post',
    path: '/v1/catalog/promotions',
    body: { name: 'X', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'GET /v1/catalog/promotions/:id',
    method: 'get',
    path: `/v1/catalog/promotions/${MISSING_ID}`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/promotions/:id',
    method: 'patch',
    path: `/v1/catalog/promotions/${MISSING_ID}`,
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/catalog/promotions/:id/active',
    method: 'patch',
    path: `/v1/catalog/promotions/${MISSING_ID}/active`,
    body: { active: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Configuración
  {
    name: 'PATCH /v1/config/parameters/:key',
    method: 'patch',
    path: '/v1/config/parameters/MAX_DISTANCE_KM',
    body: { value: 5 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'POST /v1/config/order-states',
    method: 'post',
    path: '/v1/config/order-states',
    body: { code: 'x', name: 'X', order: 1 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PUT /v1/config/order-states/:code',
    method: 'put',
    path: '/v1/config/order-states/pending',
    body: { name: 'X' },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/config/order-states/:code/active',
    method: 'patch',
    path: '/v1/config/order-states/pending/active',
    body: { active: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Sucursales
  {
    name: 'POST /v1/branches',
    method: 'post',
    path: '/v1/branches',
    body: { name: 'X', addressText: 'Y', latitude: 0, longitude: 0 },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/branches/:id/active',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/active`,
    body: { active: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PUT /v1/branches/:id/hours',
    method: 'put',
    path: `/v1/branches/${MISSING_ID}/hours`,
    body: { hours: [] },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'GET /v1/branches/:id/products',
    method: 'get',
    path: `/v1/branches/${MISSING_ID}/products`,
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },
  {
    name: 'PATCH /v1/branches/:id/products/:pid/availability',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/products/${MISSING_ID}/availability`,
    body: { available: true },
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Uploads
  {
    name: 'POST /v1/catalog/uploads',
    method: 'post',
    path: '/v1/catalog/uploads',
    forbiddenRole: 'rider',
    forbiddenToken: riderToken,
  },

  // Mutaciones de carrito (customer-only: super_admin es rol incorrecto)
  {
    name: 'POST /v1/carts/items',
    method: 'post',
    path: '/v1/carts/items',
    body: { productId: MISSING_ID, quantity: 1 },
    forbiddenRole: 'super_admin',
    forbiddenToken: superToken,
  },
  {
    name: 'PATCH /v1/carts/items/:itemId',
    method: 'patch',
    path: `/v1/carts/items/${MISSING_ID}`,
    body: { quantity: 1 },
    forbiddenRole: 'super_admin',
    forbiddenToken: superToken,
  },
  {
    name: 'DELETE /v1/carts/items/:itemId',
    method: 'delete',
    path: `/v1/carts/items/${MISSING_ID}`,
    forbiddenRole: 'super_admin',
    forbiddenToken: superToken,
  },
  {
    name: 'POST /v1/carts/confirm',
    method: 'post',
    path: '/v1/carts/confirm',
    forbiddenRole: 'super_admin',
    forbiddenToken: superToken,
  },

  // Pedidos
  {
    name: 'POST /v1/orders/:orderId/repeat',
    method: 'post',
    path: `/v1/orders/${MISSING_ID}/repeat`,
    forbiddenRole: 'super_admin',
    forbiddenToken: superToken,
  },
  {
    name: 'PATCH /v1/orders/:orderId/status',
    method: 'patch',
    path: `/v1/orders/${MISSING_ID}/status`,
    body: { status: 'confirmed' },
    forbiddenRole: 'customer',
    forbiddenToken: customerToken,
  },
]

describe('Commerce — matriz de autorización por endpoint (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]

  const send = (entry: AuthorizationCase): request.Test => {
    const agent = request(app.getHttpServer())
    const test =
      entry.method === 'get'
        ? agent.get(entry.path)
        : entry.method === 'post'
          ? agent.post(entry.path)
          : entry.method === 'put'
            ? agent.put(entry.path)
            : entry.method === 'patch'
              ? agent.patch(entry.path)
              : agent.delete(entry.path)

    return entry.body ? test.send(entry.body) : test
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
        PromotionModule,
        BranchModule,
        CartModule,
        OrderModule,
        StockModule,
        ParameterModule,
        OrderStateModule,
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
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  it.each(CASES)('$name sin token → 401 UNAUTHENTICATED', async (entry) => {
    const res = await send(entry).expect(401)
    expect(res.body.code).toBe('UNAUTHENTICATED')
  })

  it.each(CASES)('$name con rol $forbiddenRole → 403 FORBIDDEN', async (entry) => {
    const res = await send(entry)
      .set(...auth(entry.forbiddenToken))
      .expect(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })
})
