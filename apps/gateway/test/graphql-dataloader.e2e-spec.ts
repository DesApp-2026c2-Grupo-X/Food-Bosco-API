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

const rawUser = (id: string, role = 'customer') => ({
  id,
  email: `${id}@example.com`,
  firstName: 'Nombre',
  lastName: 'Apellido',
  phone: '1',
  role,
  active: true,
  branchId: null,
  vehicle: null,
})

const rawBranch = (id: string) => ({
  id,
  name: `Sucursal ${id}`,
  addressText: 'Calle 1',
  latitude: -34.6,
  longitude: -58.4,
  phone: null,
  active: true,
  hours: [],
})

const rawIngredient = { id: 'i1', name: 'Queso', unit: 'kg', active: true }

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

const rawProductWithRecipe = {
  ...rawProduct('p1', 'c1'),
  recipe: [{ id: 'ri1', ingredientId: 'i1', quantity: 0.2 }],
}

const rawOrder = (id: string, clientId: string, branchId: string) => ({
  id,
  number: id,
  clientId,
  branchId,
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: 'pending',
  total: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: [],
})

const responderFor = (
  handlers: Record<string, unknown>,
): ((call: { method: string; path: string }) => ReturnType<typeof okResponse> | undefined) => {
  return (call) => {
    const key = `${call.method} ${call.path}`
    return key in handlers ? okResponse(handlers[key]) : undefined
  }
}

describe('Gateway DataLoader (e2e) — resolución cross-service y HTTP calls', () => {
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

  const run = (query: string, role: string) => {
    const token = signToken({ userId: 'u1', roles: [role] })
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql(query))
  }

  describe('RQ-GW-08: campos que cruzan servicios', () => {
    it('Order.client → Auth y Order.branch → Commerce', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/orders/o1': rawOrder('o1', 'u1', 'b1'),
          'GET /v1/users/u1': rawUser('u1'),
          'GET /v1/branches/b1': rawBranch('b1'),
        }),
      )

      const res = await run(
        'query { order(id: "o1") { client { id } branch { id } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toEqual({
        order: { client: { id: 'u1' }, branch: { id: 'b1' } },
      })
      expect(callsTo(downstream, '/v1/users/u1')).toHaveLength(1)
      expect(callsTo(downstream, '/v1/branches/b1')).toHaveLength(1)
    })

    it('Product.category → Commerce', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/catalog/products/p1': rawProduct('p1', 'c1'),
          'GET /v1/catalog/categories/c1': { id: 'c1', name: 'Hamburguesas', active: true },
        }),
      )

      const res = await run(
        'query { product(id: "p1") { category { id name } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toEqual({ product: { category: { id: 'c1', name: 'Hamburguesas' } } })
      expect(callsTo(downstream, '/v1/catalog/categories/c1')).toHaveLength(1)
    })

    it('RecipeItem.ingredient → Commerce', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/catalog/products/p1': rawProductWithRecipe,
          'GET /v1/catalog/ingredients/i1': rawIngredient,
        }),
      )

      const res = await run(
        'query { product(id: "p1") { recipe { ingredientId ingredient { id name unit } quantity } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toEqual({
        product: {
          recipe: [
            {
              ingredientId: 'i1',
              ingredient: { id: 'i1', name: 'Queso', unit: 'kg' },
              quantity: 0.2,
            },
          ],
        },
      })
      expect(callsTo(downstream, '/v1/catalog/ingredients/i1')).toHaveLength(1)
    })

    it('CartItem.product → Commerce', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/carts': {
            id: 'cart1',
            clientId: 'u1',
            status: 'active',
            items: [{ id: 'ci1', productId: 'p1', quantity: 2, observations: null, optionIds: [] }],
            total: 20,
          },
          'GET /v1/catalog/products/p1': rawProduct('p1', 'c1'),
        }),
      )

      const res = await run(
        'query { myCart { items { id quantity product { id name } } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toEqual({
        myCart: { items: [{ id: 'ci1', quantity: 2, product: { id: 'p1', name: 'Producto p1' } }] },
      })
      expect(callsTo(downstream, '/v1/catalog/products/p1')).toHaveLength(1)
    })

    it('TripOrder.order resuelve la orden vía Commerce/DataLoader (RQ-GW-08/09)', async () => {
      downstream.setResponder(
        responderFor({
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
          'GET /v1/orders/ord-1': rawOrder('ord-1', 'u1', 'b1'),
        }),
      )

      const res = await run('query { trip(id: "t1") { orders { order { id } } } }', 'rider').expect(
        200,
      )
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({ trip: { orders: [{ order: { id: 'ord-1' } }] } })
      expect(callsTo(downstream, '/v1/orders/ord-1')).toHaveLength(1)
    })

    it('TripOrder.order propaga el contexto REST (auth) al loader de Commerce (NEW-15)', async () => {
      downstream.setResponder(
        responderFor({
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
          'GET /v1/orders/ord-1': rawOrder('ord-1', 'u1', 'b1'),
        }),
      )

      const token = signToken({ userId: 'u1', roles: ['rider'] })
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-Id', 'req-dataloader-1')
        .send(gql('query { trip(id: "t1") { orders { order { id } } } }'))
        .expect(200)

      const orderCall = callsTo(downstream, '/v1/orders/ord-1')[0]
      expect(orderCall).toBeDefined()
      expect(orderCall.headers.authorization).toBe(`Bearer ${token}`)
      expect(orderCall.headers['x-user-id']).toBe('u1')
      expect(orderCall.headers['x-user-roles']).toBe('rider')
      expect(orderCall.headers['x-request-id']).toBe('req-dataloader-1')
    })

    it('TripOrder.order deduplica la misma orden referenciada dos veces en el lote', async () => {
      downstream.setResponder(
        responderFor({
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
              {
                orderId: 'ord-1',
                pickupBranchId: 'b1',
                pickupLocation: { latitude: 0, longitude: 0 },
                deliveryAddress: { text: 't', latitude: 0, longitude: 0 },
                status: 'on_the_way',
              },
            ],
          },
          'GET /v1/orders/ord-1': rawOrder('ord-1', 'u1', 'b1'),
        }),
      )

      const res = await run('query { trip(id: "t1") { orders { order { id } } } }', 'rider').expect(
        200,
      )
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({
        trip: { orders: [{ order: { id: 'ord-1' } }, { order: { id: 'ord-1' } }] },
      })
      expect(callsTo(downstream, '/v1/orders/ord-1')).toHaveLength(1)
    })
  })

  describe('RQ-GW-09: batching por lote y deduplicación', () => {
    it('agrupa llaves distintas de una lista: una llamada única por referencia', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/orders': { data: [rawOrder('o1', 'u1', 'b1'), rawOrder('o2', 'u2', 'b2')] },
          'GET /v1/users/u1': rawUser('u1'),
          'GET /v1/users/u2': rawUser('u2', 'rider'),
          'GET /v1/branches/b1': rawBranch('b1'),
          'GET /v1/branches/b2': rawBranch('b2'),
        }),
      )

      const res = await run(
        'query { myOrders { id client { id } branch { id } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(callsTo(downstream, '/v1/users/u1')).toHaveLength(1)
      expect(callsTo(downstream, '/v1/users/u2')).toHaveLength(1)
      expect(callsTo(downstream, '/v1/branches/b1')).toHaveLength(1)
      expect(callsTo(downstream, '/v1/branches/b2')).toHaveLength(1)
    })

    it('deduplica la misma llave repetida dentro del lote', async () => {
      downstream.setResponder(
        responderFor({
          'GET /v1/catalog/products': {
            data: [rawProduct('p1', 'c1'), rawProduct('p2', 'c1')],
          },
          'GET /v1/catalog/categories/c1': { id: 'c1', name: 'Hamburguesas', active: true },
        }),
      )

      const res = await run('query { products { id category { id } } }', 'customer').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toEqual({
        products: [
          { id: 'p1', category: { id: 'c1' } },
          { id: 'p2', category: { id: 'c1' } },
        ],
      })
      // RQ-GW-09: la misma categoría se pide una sola vez en el lote.
      expect(callsTo(downstream, '/v1/catalog/categories/c1')).toHaveLength(1)
    })
  })
})
