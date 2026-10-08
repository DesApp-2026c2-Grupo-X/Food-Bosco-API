import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  gql,
  GraphQLBody,
  okResponse,
  queryParams,
  signToken,
} from './downstream'

const rawStock = { branchId: 'b1', ingredientId: 'i1', quantity: 5 }

const rawIngredient = { id: 'i1', name: 'Queso', unit: 'kg', active: true }

const rawOutOfStock = {
  product: { id: 'p1', name: 'Burger' },
  category: { id: 'c1', name: 'Hamburguesas', active: true },
  quantity: 0,
}

type HandlerMap = Record<string, unknown>

const respondWith =
  (handlers: HandlerMap) =>
  (call: { method: string; path: string }): ReturnType<typeof okResponse> | undefined => {
    const key = `${call.method} ${call.path}`
    return key in handlers ? okResponse(handlers[key]) : undefined
  }

describe('Gateway stock (e2e) — branchStock / adjustStock / outOfStockProducts', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    await app.listen(0)
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const run = (query: string, role: string, payload: Record<string, unknown> = {}) => {
    const token = signToken({ userId: 'u1', roles: [role], ...payload })
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query))
  }

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  it('F1: branchStock sin branchId (super_admin) no envía el parámetro', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/stock': [rawStock] }))

    const res = await run(
      'query { branchStock { branchId ingredientId quantity } }',
      'super_admin',
    ).expect(200)

    expect((res.body as GraphQLBody).data).toEqual({
      branchStock: [{ branchId: 'b1', ingredientId: 'i1', quantity: 5 }],
    })
    expect(queryParams(callFor('GET', '/v1/stock').url).has('branchId')).toBe(false)
  })

  it('F2: branchStock con branchId propaga el filtro', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/stock': [rawStock] }))

    await run('query { branchStock(branchId: "b1") { quantity } }', 'branch_admin').expect(200)

    expect(queryParams(callFor('GET', '/v1/stock').url).get('branchId')).toBe('b1')
  })

  it('F3: BranchStock.ingredient se resuelve por DataLoader', async () => {
    downstream.setResponder(
      respondWith({
        'GET /v1/stock': [rawStock],
        'GET /v1/catalog/ingredients/i1': rawIngredient,
      }),
    )

    const res = await run(
      'query { branchStock(branchId: "b1") { ingredientId quantity ingredient { id name unit } } }',
      'branch_admin',
    ).expect(200)

    expect((res.body as GraphQLBody).data).toEqual({
      branchStock: [
        {
          ingredientId: 'i1',
          quantity: 5,
          ingredient: { id: 'i1', name: 'Queso', unit: 'kg' },
        },
      ],
    })
    expect(callFor('GET', '/v1/catalog/ingredients/i1')).toBeDefined()
  })

  it('F4: adjustStock envía el input completo y mapea la respuesta', async () => {
    downstream.setResponder(
      respondWith({ 'POST /v1/stock/adjustments': { ...rawStock, quantity: 3 } }),
    )

    const res = await run(
      'mutation { adjustStock(input: { branchId: "b1", ingredientId: "i1", delta: -2, reason: "adjust" }) { branchId ingredientId quantity } }',
      'branch_admin',
    ).expect(200)

    expect((res.body as GraphQLBody).data).toEqual({
      adjustStock: { branchId: 'b1', ingredientId: 'i1', quantity: 3 },
    })
    expect(callFor('POST', '/v1/stock/adjustments').body).toEqual({
      branchId: 'b1',
      ingredientId: 'i1',
      delta: -2,
      reason: 'adjust',
    })
  })

  it('F5: outOfStockProducts propaga el filtro de sucursal y mapea quantity', async () => {
    downstream.setResponder(
      respondWith({ 'GET /v1/reporting/products/out-of-stock': [rawOutOfStock] }),
    )

    const res = await run(
      'query { outOfStockProducts(filter: { branchId: "b1" }) { product { id name } category { id } quantity } }',
      'branch_admin',
    ).expect(200)

    expect((res.body as GraphQLBody).data).toEqual({
      outOfStockProducts: [
        { product: { id: 'p1', name: 'Burger' }, category: { id: 'c1' }, quantity: 0 },
      ],
    })
    expect(
      queryParams(callFor('GET', '/v1/reporting/products/out-of-stock').url).get('branchId'),
    ).toBe('b1')
  })

  it.each([
    {
      name: 'adjustStock',
      query:
        'mutation { adjustStock(input: { branchId: "b1", ingredientId: "i1", delta: 1, reason: "adjust" }) { quantity } }',
    },
    { name: 'branchStock', query: 'query { branchStock { quantity } }' },
  ])('F6: $name con customer → FORBIDDEN', async ({ query }) => {
    const res = await run(query, 'customer').expect(200)
    const body = res.body as GraphQLBody

    expect(body.data).toBeNull()
    expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
    expect(downstream.calls).toHaveLength(0)
  })
})
