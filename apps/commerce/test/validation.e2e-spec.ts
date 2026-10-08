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

const MISSING_ID = '000000000000000000000000'

const superToken = jwt.sign({ userId: 'admin-1', roles: ['super_admin'] }, env.jwtSecret)
const customerToken = jwt.sign({ userId: 'cust-1', roles: ['customer'] }, env.jwtSecret)

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface InvalidCase {
  name: string
  method: HttpMethod
  path: string
  token: string
  body?: Record<string, unknown>
}

// Matriz de validaciones 400 faltantes. Todas las entradas tienen forma de payload
// inválida y el backend debe rechazarlas con VALIDATION_ERROR antes de tocar dominio.
const CASES: InvalidCase[] = [
  // POST /v1/catalog/products
  {
    name: 'POST /v1/catalog/products con price<0',
    method: 'post',
    path: '/v1/catalog/products',
    token: superToken,
    body: { categoryId: 'cat', name: 'X', description: 'D', price: -1 },
  },
  {
    name: 'POST /v1/catalog/products con name vacío',
    method: 'post',
    path: '/v1/catalog/products',
    token: superToken,
    body: { categoryId: 'cat', name: '', description: 'D', price: 1 },
  },
  {
    name: 'POST /v1/catalog/products con categoryId vacío',
    method: 'post',
    path: '/v1/catalog/products',
    token: superToken,
    body: { categoryId: '', name: 'X', description: 'D', price: 1 },
  },
  {
    name: 'POST /v1/catalog/products sin description',
    method: 'post',
    path: '/v1/catalog/products',
    token: superToken,
    body: { categoryId: 'cat', name: 'X', price: 1 },
  },

  // PATCH /v1/catalog/products/:id
  {
    name: 'PATCH /v1/catalog/products/:id con price<0',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}`,
    token: superToken,
    body: { price: -1 },
  },
  {
    name: 'PATCH /v1/catalog/products/:id con name vacío',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}`,
    token: superToken,
    body: { name: '' },
  },
  {
    name: 'PATCH /v1/catalog/products/:id con categoryId vacío',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}`,
    token: superToken,
    body: { categoryId: '' },
  },

  // PATCH /v1/catalog/products/:id/available
  {
    name: 'PATCH /v1/catalog/products/:id/available sin available',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/available`,
    token: superToken,
    body: {},
  },
  {
    name: 'PATCH /v1/catalog/products/:id/available con available nulo',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/available`,
    token: superToken,
    body: { available: null },
  },

  // POST/PATCH categorías
  {
    name: 'POST /v1/catalog/categories con name vacío',
    method: 'post',
    path: '/v1/catalog/categories',
    token: superToken,
    body: { name: '' },
  },
  {
    name: 'POST /v1/catalog/categories sin name',
    method: 'post',
    path: '/v1/catalog/categories',
    token: superToken,
    body: {},
  },
  {
    name: 'POST /v1/catalog/categories con name de 101 caracteres',
    method: 'post',
    path: '/v1/catalog/categories',
    token: superToken,
    body: { name: 'a'.repeat(101) },
  },
  {
    name: 'PATCH /v1/catalog/categories/:id con name vacío',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}`,
    token: superToken,
    body: { name: '' },
  },
  {
    name: 'PATCH /v1/catalog/categories/:id/active sin active',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}/active`,
    token: superToken,
    body: {},
  },

  // POST/PATCH ingredientes
  {
    name: 'POST /v1/catalog/ingredients sin unit',
    method: 'post',
    path: '/v1/catalog/ingredients',
    token: superToken,
    body: { name: 'X' },
  },
  {
    name: 'POST /v1/catalog/ingredients con name vacío',
    method: 'post',
    path: '/v1/catalog/ingredients',
    token: superToken,
    body: { name: '', unit: 'kg' },
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id con unit vacío',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}`,
    token: superToken,
    body: { unit: '' },
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id/active sin active',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}/active`,
    token: superToken,
    body: {},
  },

  // PATCH /v1/carts/items/:itemId
  {
    name: 'PATCH /v1/carts/items/:itemId con quantity 0',
    method: 'patch',
    path: `/v1/carts/items/${MISSING_ID}`,
    token: customerToken,
    body: { quantity: 0 },
  },
  {
    name: 'PATCH /v1/carts/items/:itemId con quantity negativa',
    method: 'patch',
    path: `/v1/carts/items/${MISSING_ID}`,
    token: customerToken,
    body: { quantity: -3 },
  },

  // PATCH /v1/orders/:id/status
  {
    name: 'PATCH /v1/orders/:id/status con status fuera del enum',
    method: 'patch',
    path: `/v1/orders/${MISSING_ID}/status`,
    token: superToken,
    body: { status: 'inventado' },
  },

  // GET /v1/orders
  {
    name: 'GET /v1/orders con limit>100',
    method: 'get',
    path: '/v1/orders?limit=101',
    token: superToken,
  },
  {
    name: 'GET /v1/orders con status inválido',
    method: 'get',
    path: '/v1/orders?status=inventado',
    token: superToken,
  },

  // PATCH /v1/branches/:id/active
  {
    name: 'PATCH /v1/branches/:id/active sin active',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/active`,
    token: superToken,
    body: {},
  },
  {
    name: 'PATCH /v1/branches/:id/active con active nulo',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/active`,
    token: superToken,
    body: { active: null },
  },

  // PATCH /v1/branches/:id/products/:pid/availability
  {
    name: 'PATCH /v1/branches/:id/products/:pid/availability sin available',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/products/${MISSING_ID}/availability`,
    token: superToken,
    body: {},
  },

  // INT-03: campos booleanos de body con valor no booleano (string/número) deben
  // dar 400 en lugar de coaccionarse a `true` por `enableImplicitConversion`.
  {
    name: 'POST /v1/catalog/products con available string',
    method: 'post',
    path: '/v1/catalog/products',
    token: superToken,
    body: { categoryId: 'cat', name: 'X', description: 'D', price: 1, available: 'false' },
  },
  {
    name: 'PATCH /v1/catalog/products/:id con available numérico',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}`,
    token: superToken,
    body: { available: 123 },
  },
  {
    name: 'PATCH /v1/catalog/products/:id/available con available string',
    method: 'patch',
    path: `/v1/catalog/products/${MISSING_ID}/available`,
    token: superToken,
    body: { available: 'false' },
  },
  {
    name: 'POST /v1/catalog/categories con active string',
    method: 'post',
    path: '/v1/catalog/categories',
    token: superToken,
    body: { name: 'Bebidas', active: 'yes' },
  },
  {
    name: 'PATCH /v1/catalog/categories/:id con active numérico',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}`,
    token: superToken,
    body: { active: 123 },
  },
  {
    name: 'PATCH /v1/catalog/categories/:id/active con active string',
    method: 'patch',
    path: `/v1/catalog/categories/${MISSING_ID}/active`,
    token: superToken,
    body: { active: 'false' },
  },
  {
    name: 'POST /v1/catalog/ingredients con active string',
    method: 'post',
    path: '/v1/catalog/ingredients',
    token: superToken,
    body: { name: 'Sal', unit: 'g', active: 'yes' },
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id con active numérico',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}`,
    token: superToken,
    body: { active: 123 },
  },
  {
    name: 'PATCH /v1/catalog/ingredients/:id/active con active string',
    method: 'patch',
    path: `/v1/catalog/ingredients/${MISSING_ID}/active`,
    token: superToken,
    body: { active: 'false' },
  },
  {
    name: 'POST /v1/branches con active string',
    method: 'post',
    path: '/v1/branches',
    token: superToken,
    body: { name: 'Centro', addressText: 'Av 1', latitude: -34.6, longitude: -58.4, active: 'yes' },
  },
  {
    name: 'PATCH /v1/branches/:id con active numérico',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}`,
    token: superToken,
    body: { active: 123 },
  },
  {
    name: 'PATCH /v1/branches/:id/active con active string',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/active`,
    token: superToken,
    body: { active: 'false' },
  },
  {
    name: 'PATCH /v1/branches/:id/products/:pid/availability con available string',
    method: 'patch',
    path: `/v1/branches/${MISSING_ID}/products/${MISSING_ID}/availability`,
    token: superToken,
    body: { available: 'false' },
  },
]

describe('Commerce — validaciones 400 faltantes (e2e)', () => {
  let mongod: MongoMemoryServer
  let app: INestApplication<App>

  const auth = (token: string): [string, string] => ['Authorization', `Bearer ${token}`]

  const send = (entry: InvalidCase): request.Test => {
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
        CartModule,
        OrderModule,
        BranchModule,
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
  })

  afterAll(async () => {
    await app.close()
    await mongod.stop()
  })

  it.each(CASES)('$name → 400 VALIDATION_ERROR', async (entry) => {
    const res = await send(entry)
      .set(...auth(entry.token))
      .expect(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})
