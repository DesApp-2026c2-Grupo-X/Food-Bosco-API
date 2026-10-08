import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  callsTo,
  createDownstreamMock,
  DownstreamMock,
  gql,
  GraphQLBody,
  okResponse,
  signToken,
} from './downstream'

const rawProduct = (id: string, categoryId: string) => ({
  id,
  categoryId,
  name: `Producto ${id}`,
  description: 'desc',
  price: 10,
  image: null,
  available: true,
  configGroups: [],
  recipe: [],
})

const rawOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  number: '0001',
  clientId: 'u1',
  riderId: null,
  branchId: 'b1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: 'pending',
  total: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: [],
  ...overrides,
})

const rawCart = (productId: string, optionIds: string[] = []) => ({
  id: 'cart1',
  clientId: 'u1',
  status: 'active',
  items: [{ id: 'ci1', productId, quantity: 1, observations: null, optionIds }],
  total: 10,
})

type HandlerMap = Record<string, unknown>

const respondWith = (handlers: HandlerMap) => (call: { method: string; path: string }) => {
  const key = `${call.method} ${call.path}`
  return key in handlers ? okResponse(handlers[key]) : undefined
}

describe('Gateway field resolvers (e2e) — ramas nulas/vacías', () => {
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

  const run = (query: string, role: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${signToken({ userId: 'u1', roles: [role] })}`)
      .send(gql(query))

  it('Product.category → null cuando la categoría no existe', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/catalog/products/p1': rawProduct('p1', 'c1') }))

    const res = await run('query { product(id: "p1") { id category { id } } }', 'customer').expect(
      200,
    )
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ product: { id: 'p1', category: null } })
    expect(callsTo(downstream, '/v1/catalog/categories/c1')).toHaveLength(1)
  })

  it('RecipeItem.ingredient → null cuando el ingrediente no existe', async () => {
    downstream.setResponder(
      respondWith({
        'GET /v1/catalog/products/p1': {
          ...rawProduct('p1', 'c1'),
          recipe: [{ id: 'ri1', ingredientId: 'i1', quantity: 0.2 }],
        },
      }),
    )

    const res = await run(
      'query { product(id: "p1") { recipe { id ingredientId ingredient { id } } } }',
      'customer',
    ).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      product: { recipe: [{ id: 'ri1', ingredientId: 'i1', ingredient: null }] },
    })
    expect(callsTo(downstream, '/v1/catalog/ingredients/i1')).toHaveLength(1)
  })

  it('CartItem.product → null cuando el producto no existe', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/carts': rawCart('p1') }))

    const res = await run('query { myCart { items { id product { id } } } }', 'customer').expect(
      200,
    )
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ myCart: { items: [{ id: 'ci1', product: null }] } })
    expect(callsTo(downstream, '/v1/catalog/products/p1')).toHaveLength(1)
  })

  it('CartItem.options → [] cuando el producto no existe', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/carts': rawCart('p-missing', ['o1']) }))

    const res = await run('query { myCart { items { id options { id } } } }', 'customer').expect(
      200,
    )
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ myCart: { items: [{ id: 'ci1', options: [] }] } })
    expect(callsTo(downstream, '/v1/catalog/products/p-missing')).toHaveLength(1)
  })

  it('Order.client → null cuando el usuario no existe', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/orders/o1': rawOrder() }))

    const res = await run('query { order(id: "o1") { id client { id } } }', 'customer').expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ order: { id: 'o1', client: null } })
    expect(callsTo(downstream, '/v1/users/u1')).toHaveLength(1)
  })

  it('Order.branch → null cuando la sucursal no existe', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/orders/o1': rawOrder() }))

    const res = await run('query { order(id: "o1") { id branch { id } } }', 'customer').expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ order: { id: 'o1', branch: null } })
    expect(callsTo(downstream, '/v1/branches/b1')).toHaveLength(1)
  })

  it('BranchStock.ingredient → null cuando el ingrediente no existe', async () => {
    downstream.setResponder(
      respondWith({ 'GET /v1/stock': [{ branchId: 'b1', ingredientId: 'i1', quantity: 5 }] }),
    )

    const res = await run(
      'query { branchStock { ingredientId ingredient { id } } }',
      'branch_admin',
    ).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ branchStock: [{ ingredientId: 'i1', ingredient: null }] })
    expect(callsTo(downstream, '/v1/catalog/ingredients/i1')).toHaveLength(1)
  })

  it('TripOrder.order → null cuando la orden no existe', async () => {
    downstream.setResponder(
      respondWith({
        'GET /v1/trips/t1': {
          id: 't1',
          riderId: 'u1',
          status: 'active',
          orders: [
            {
              orderId: 'ord-1',
              pickupBranchId: 'b1',
              pickupLocation: { latitude: 0, longitude: 0 },
              deliveryAddress: { text: 't', latitude: 0, longitude: 0 },
              status: 'on_the_way',
            },
          ],
        },
      }),
    )

    const res = await run(
      'query { trip(id: "t1") { orders { orderId order { id } } } }',
      'rider',
    ).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ trip: { orders: [{ orderId: 'ord-1', order: null }] } })
    expect(callsTo(downstream, '/v1/orders/ord-1')).toHaveLength(1)
  })

  it('Order.riderLocation → null sin consultar Delivery cuando riderId es null', async () => {
    downstream.setResponder(respondWith({ 'GET /v1/orders/o1': rawOrder({ riderId: null }) }))

    const res = await run(
      'query { order(id: "o1") { id riderLocation { latitude longitude } } }',
      'customer',
    ).expect(200)
    const body = res.body as GraphQLBody

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ order: { id: 'o1', riderLocation: null } })
    // Rama temprana: sólo se llamó a Commerce por la orden, nunca a Delivery.
    expect(downstream.calls).toHaveLength(1)
    expect(downstream.calls[0].path).toBe('/v1/orders/o1')
  })
})
