import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  callsTo,
  createDownstreamMock,
  DownstreamCall,
  DownstreamMock,
  errorResponse,
  gql,
  GraphQLBody,
  okResponse,
  queryParams,
  signToken,
} from './downstream'

const rawIngredient = { id: 'i1', name: 'Queso', unit: 'kg', active: true }

const rawPromotion = {
  id: 'pr1',
  name: '2x1',
  description: 'promo',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  active: true,
}

const rawBranchHour = { dayOfWeek: 1, opening: '09:00', closing: '18:00', closed: false }

const rawBranch = {
  id: 'b1',
  name: 'Centro',
  addressText: 'Calle 1',
  latitude: -34.6,
  longitude: -58.4,
  phone: null,
  active: true,
  hours: [rawBranchHour],
}

const rawOrder = {
  id: 'o1',
  number: '0001',
  clientId: 'u1',
  riderId: 'r1',
  branchId: 'b1',
  deliveryAddress: { text: 'Av 1', latitude: -34.6, longitude: -58.4 },
  status: 'confirmed',
  total: 21.5,
  estimatedDeliveryAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: [],
}

const rawConfigGroupMultiple = {
  id: 'g1',
  name: 'Extras',
  type: 'multiple',
  required: true,
  min: null,
  max: null,
  options: [],
}

const rawOverview = {
  period: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' },
  kpis: {
    totalRevenue: 100,
    totalOrders: 3,
    averageTicket: 33.3,
    cancelledOrders: 1,
    bestSellingProduct: null,
    topBranch: null,
  },
  variation: { revenuePct: 1, ordersPct: 2, averageTicketPct: 3 },
  salesSeries: [{ bucket: '2026-01-01', revenue: 10, orders: 1 }],
  ordersByStatus: [{ status: 'cancelled', count: 2 }],
  topProducts: [{ productId: 'p1', name: 'Burger', quantity: 5, revenue: 50 }],
  branchPerformance: [{ branchId: 'b1', branchName: 'Centro', revenue: 100, orders: 3 }],
}

type HandlerMap = Record<string, unknown>

const respondWith = (handlers: HandlerMap) => (call: { method: string; path: string }) => {
  const key = `${call.method} ${call.path}`
  return key in handlers ? okResponse(handlers[key]) : undefined
}

describe('Gateway commerce extendido (e2e) — gaps de cobertura', () => {
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

  const post = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req.send(gql(query))
  }

  const run = (query: string, role: string) =>
    post(query, signToken({ userId: 'u1', roles: [role] }))

  const callFor = (method: string, path: string): DownstreamCall => {
    const [call] = callsTo(downstream, path).filter((entry) => entry.method === method)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('orders (query de gestión)', () => {
    it('orders (branch_admin) mapea data, traduce filtros y pagina', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/orders': { data: [rawOrder] } }))

      const res = await run(
        'query { orders(filter: { status: CONFIRMED, branchId: "b1", search: "0001" }, page: { limit: 1, offset: 2 }) { id number status } }',
        'branch_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        orders: [{ id: 'o1', number: '0001', status: 'CONFIRMED' }],
      })
      const params = queryParams(callFor('GET', '/v1/orders').url)
      expect(params.get('status')).toBe('confirmed')
      expect(params.get('branchId')).toBe('b1')
      expect(params.get('search')).toBe('0001')
      expect(params.get('limit')).toBe('1')
      expect(params.get('offset')).toBe('2')
    })

    it('orders (super_admin) sin filtros no envía parámetros opcionales', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/orders': { data: [] } }))

      const res = await run('query { orders { id } }', 'super_admin').expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ orders: [] })
      const params = queryParams(callFor('GET', '/v1/orders').url)
      expect(params.has('status')).toBe(false)
      expect(params.has('branchId')).toBe(false)
      expect(params.has('search')).toBe(false)
      expect(params.has('limit')).toBe(false)
      expect(params.has('offset')).toBe(false)
    })

    it.each(['customer', 'rider'])('orders con %s → FORBIDDEN', async (role) => {
      const res = await run('query { orders { id } }', role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(downstream.calls).toHaveLength(0)
    })

    it('orders propaga un 4xx downstream con su code/message/path', async () => {
      downstream.setResponder(() =>
        errorResponse(400, 'INVALID_FILTER', 'Filtro inválido', '/v1/orders'),
      )

      const res = await run('query { orders { id } }', 'branch_admin').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({ code: 'INVALID_FILTER', path: '/v1/orders' })
      expect(body.errors?.[0].message).toBe('Filtro inválido')
    })

    it('orders propaga un 5xx downstream sin code como INTERNAL_SERVER_ERROR', async () => {
      downstream.setResponder(() => ({ status: 500, body: { message: 'sin code' } }))

      const res = await run('query { orders { id } }', 'branch_admin').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR')
      expect(body.errors?.[0].message).toBe('commerce devolvió HTTP 500')
    })
  })

  describe('queries por id', () => {
    it('ingredient(id) hace GET por id', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/ingredients/i1': rawIngredient }))

      const res = await run(
        'query { ingredient(id: "i1") { id name unit active } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        ingredient: { id: 'i1', name: 'Queso', unit: 'kg', active: true },
      })
      expect(callFor('GET', '/v1/catalog/ingredients/i1')).toBeDefined()
    })

    it('ingredient(id) inexistente propaga 404', async () => {
      downstream.setResponder(() =>
        errorResponse(
          404,
          'INGREDIENT_NOT_FOUND',
          'Ingrediente inexistente',
          '/v1/catalog/ingredients/x',
        ),
      )

      const res = await run('query { ingredient(id: "x") { id } }', 'super_admin').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'INGREDIENT_NOT_FOUND',
        path: '/v1/catalog/ingredients/x',
      })
    })

    it('promotion(id) hace GET por id (super_admin)', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/catalog/promotions/pr1': rawPromotion }))

      const res = await run(
        'query { promotion(id: "pr1") { id name startDate endDate active } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        promotion: {
          id: 'pr1',
          name: '2x1',
          startDate: '2026-01-01',
          endDate: '2026-02-01',
          active: true,
        },
      })
      expect(callFor('GET', '/v1/catalog/promotions/pr1')).toBeDefined()
    })

    it('promotion(id) inexistente propaga 404', async () => {
      downstream.setResponder(() =>
        errorResponse(
          404,
          'PROMOTION_NOT_FOUND',
          'Promoción inexistente',
          '/v1/catalog/promotions/x',
        ),
      )

      const res = await run('query { promotion(id: "x") { id } }', 'super_admin').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'PROMOTION_NOT_FOUND',
        path: '/v1/catalog/promotions/x',
      })
    })

    it('branch(id) hace GET por id', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/branches/b1': rawBranch }))

      const res = await run(
        'query { branch(id: "b1") { id name addressText hours { dayOfWeek opening } } }',
        'customer',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        branch: {
          id: 'b1',
          name: 'Centro',
          addressText: 'Calle 1',
          hours: [{ dayOfWeek: 1, opening: '09:00' }],
        },
      })
      expect(callFor('GET', '/v1/branches/b1')).toBeDefined()
    })

    it('branch(id) inexistente propaga 404', async () => {
      downstream.setResponder(() =>
        errorResponse(404, 'BRANCH_NOT_FOUND', 'Sucursal inexistente', '/v1/branches/x'),
      )

      const res = await run('query { branch(id: "x") { id } }', 'customer').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'BRANCH_NOT_FOUND',
        path: '/v1/branches/x',
      })
    })
  })

  describe('reportsOverview (filtros completos)', () => {
    it('mapea from/to/branchId/categoryId/groupBy/status al downstream', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/reporting/overview': rawOverview }))

      const res = await run(
        'query { reportsOverview(filter: { from: "2026-01-01", to: "2026-01-31", branchId: "b1", categoryId: "c1", groupBy: WEEK, status: CANCELLED }) { period { from to } kpis { totalOrders } ordersByStatus { status count } topProducts { productId quantity } } }',
        'branch_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        reportsOverview: {
          period: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.999Z' },
          kpis: { totalOrders: 3 },
          ordersByStatus: [{ status: 'CANCELLED', count: 2 }],
          topProducts: [{ productId: 'p1', quantity: 5 }],
        },
      })
      const params = queryParams(callFor('GET', '/v1/reporting/overview').url)
      expect(params.get('from')).toBe('2026-01-01')
      expect(params.get('to')).toBe('2026-01-31')
      expect(params.get('branchId')).toBe('b1')
      expect(params.get('categoryId')).toBe('c1')
      expect(params.get('groupBy')).toBe('week')
      expect(params.get('status')).toBe('cancelled')
    })
  })

  describe('autorización por operación (wrong-role y sin token)', () => {
    const protectedOps: Array<{ name: string; query: string; wrongRole: string }> = [
      {
        name: 'branchProducts',
        query: 'query { branchProducts(branchId: "b1") { id } }',
        wrongRole: 'customer',
      },
      {
        name: 'setBranchProductAvailability',
        query:
          'mutation { setBranchProductAvailability(branchId: "b1", productId: "p1", available: false) }',
        wrongRole: 'customer',
      },
      {
        name: 'createProduct',
        query:
          'mutation { createProduct(input: { categoryId: "c1", name: "X", description: "d", price: 1 }) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'createConfigGroup',
        query:
          'mutation { createConfigGroup(productId: "p1", input: { name: "g", type: SINGLE, required: true }) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'createConfigOption',
        query:
          'mutation { createConfigOption(productId: "p1", groupId: "g1", input: { name: "o", extraPrice: 1 }) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'setProductRecipe',
        query:
          'mutation { setProductRecipe(productId: "p1", items: [{ ingredientId: "i1", quantity: 0.5 }]) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'createPromotion',
        query:
          'mutation { createPromotion(input: { name: "p", startDate: "2026-01-01", endDate: "2026-02-01" }) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'createBranch',
        query:
          'mutation { createBranch(input: { name: "N", addressText: "C", latitude: 1, longitude: 2 }) { id } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'updateParameter',
        query: 'mutation { updateParameter(key: "deliveryFee", value: 10) { key } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'createOrderState',
        query: 'mutation { createOrderState(input: { name: "N", order: 1 }) { code } }',
        wrongRole: 'branch_admin',
      },
      {
        name: 'addCartItem',
        query: 'mutation { addCartItem(input: { productId: "p1", quantity: 1 }) { id } }',
        wrongRole: 'rider',
      },
    ]

    it.each(protectedOps)('$name sin token → UNAUTHENTICATED', async ({ query }) => {
      const res = await post(query).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })

    it.each(protectedOps)('$name con rol $wrongRole → FORBIDDEN', async ({ query, wrongRole }) => {
      const res = await post(query, signToken({ userId: 'u1', roles: [wrongRole] })).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('propagación de errores downstream (auth y commerce)', () => {
    it('register propaga 409 EMAIL_ALREADY_EXISTS', async () => {
      downstream.setResponder(() =>
        errorResponse(
          409,
          'EMAIL_ALREADY_EXISTS',
          'El email ya está registrado',
          '/v1/auth/register',
        ),
      )

      const res = await post(
        'mutation { register(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { accessToken } }',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe('El email ya está registrado')
      expect(body.errors?.[0].extensions).toEqual({
        code: 'EMAIL_ALREADY_EXISTS',
        path: '/v1/auth/register',
      })
      expect(body.errors?.[0].path).toEqual(['register'])
    })

    it('login propaga 401 INVALID_CREDENTIALS', async () => {
      downstream.setResponder(() =>
        errorResponse(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas', '/v1/auth/login'),
      )

      const res = await post(
        'mutation { login(input: { email: "a@b.com", password: "nope" }) { accessToken } }',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'INVALID_CREDENTIALS',
        path: '/v1/auth/login',
      })
    })

    it('createOrder propaga el 404 de la dirección resuelta en Auth', async () => {
      downstream.setResponder(() =>
        errorResponse(404, 'ADDRESS_NOT_FOUND', 'Dirección inexistente', '/v1/addresses/a1'),
      )

      const res = await run('mutation { createOrder(addressId: "a1") { id } }', 'customer').expect(
        200,
      )
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'ADDRESS_NOT_FOUND',
        path: '/v1/addresses/a1',
      })
      expect(callsTo(downstream, '/v1/addresses/a1')).toHaveLength(1)
      expect(callsTo(downstream, '/v1/orders')).toHaveLength(0)
    })

    it('createOrder propaga el 409 que devuelve Commerce al confirmar', async () => {
      downstream.setResponder((call) => {
        if (call.method === 'GET' && call.path === '/v1/addresses/a1') {
          return okResponse({ id: 'a1', text: 'Av 1', latitude: -34.6, longitude: -58.4 })
        }
        if (call.method === 'POST' && call.path === '/v1/orders') {
          return errorResponse(409, 'BRANCH_CLOSED', 'La sucursal está cerrada', '/v1/orders')
        }
        return undefined
      })

      const res = await run('mutation { createOrder(addressId: "a1") { id } }', 'customer').expect(
        200,
      )
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'BRANCH_CLOSED',
        path: '/v1/orders',
      })
    })

    it('adjustStock propaga el 409 INSUFFICIENT_STOCK', async () => {
      downstream.setResponder(() =>
        errorResponse(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente', '/v1/stock/adjustments'),
      )

      const res = await run(
        'mutation { adjustStock(input: { branchId: "b1", ingredientId: "i1", delta: -99, reason: "adjust" }) { quantity } }',
        'branch_admin',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'INSUFFICIENT_STOCK',
        path: '/v1/stock/adjustments',
      })
    })

    it('repeatOrder propaga el 404 del pedido original', async () => {
      downstream.setResponder(() =>
        errorResponse(404, 'ORDER_NOT_FOUND', 'Pedido inexistente', '/v1/orders/o1/repeat'),
      )

      const res = await run(
        'mutation { repeatOrder(orderId: "o1") { cart { id } } }',
        'customer',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions).toEqual({
        code: 'ORDER_NOT_FOUND',
        path: '/v1/orders/o1/repeat',
      })
    })
  })

  describe('validación de input GraphQL', () => {
    it('rechaza un valor de enum inválido antes de llamar al downstream', async () => {
      const res = await run(
        'mutation { createConfigGroup(productId: "p1", input: { name: "g", type: BOGUS, required: true }) { id } }',
        'super_admin',
      ).expect(400)
      const body = res.body as GraphQLBody

      expect(body.errors?.length).toBeGreaterThan(0)
      expect(body.errors?.[0].message).toContain('BOGUS')
      expect(downstream.calls).toHaveLength(0)
    })

    it('rechaza campos requeridos ausentes antes de llamar al downstream', async () => {
      const res = await run(
        'mutation { createProduct(input: { name: "X" }) { id } }',
        'super_admin',
      ).expect(400)
      const body = res.body as GraphQLBody

      expect(body.errors?.length).toBeGreaterThan(0)
      expect(body.errors?.[0].message).toContain('categoryId')
      expect(downstream.calls).toHaveLength(0)
    })

    it('createConfigGroup traduce MULTIPLE → "multiple" y remapea la respuesta', async () => {
      downstream.setResponder(
        respondWith({ 'POST /v1/catalog/products/p1/configurations': rawConfigGroupMultiple }),
      )

      const res = await run(
        'mutation { createConfigGroup(productId: "p1", input: { name: "Extras", type: MULTIPLE, required: true }) { id name type } }',
        'super_admin',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        createConfigGroup: { id: 'g1', name: 'Extras', type: 'MULTIPLE' },
      })
      expect(callFor('POST', '/v1/catalog/products/p1/configurations').body).toEqual({
        name: 'Extras',
        type: 'multiple',
        required: true,
      })
    })
  })

  describe('Order.riderLocation (rama catch → null)', () => {
    const riderLocationQuery =
      'query { order(id: "o1") { id riderLocation { latitude longitude } } }'

    it.each([
      {
        name: 'Delivery responde 404',
        response: errorResponse(404, 'RIDER_NOT_FOUND', 'Sin rider', '/v1/riders/by-user/r1'),
      },
      { name: 'Delivery responde 500', response: { status: 500, body: { message: 'boom' } } },
    ])('$name → riderLocation null sin errores GraphQL', async ({ response }) => {
      downstream.setResponder((call) => {
        if (call.method === 'GET' && call.path === '/v1/orders/o1') return okResponse(rawOrder)
        if (call.method === 'GET' && call.path === '/v1/riders/by-user/r1') return response
        return undefined
      })

      const res = await run(riderLocationQuery, 'customer').expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({ order: { id: 'o1', riderLocation: null } })
      expect(callFor('GET', '/v1/riders/by-user/r1')).toBeDefined()
    })
  })
})
