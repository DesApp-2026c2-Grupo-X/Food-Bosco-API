import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'
import {
  createDownstreamMock,
  DownstreamMock,
  gql,
  GraphQLBody,
  okResponse,
  signToken,
  signTokenWithSecret,
} from './downstream'

const rawUser = {
  id: 'u1',
  email: 'cliente@example.com',
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
  role: 'customer',
  active: true,
  branchId: null,
  vehicle: null,
}

const rawRider = {
  id: 'r1',
  userId: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  vehicle: { type: 'moto' },
  phone: '11223344',
  available: true,
  currentLocation: { latitude: -34.6, longitude: -58.4 },
}

const rawOrder = {
  id: 'o1',
  number: '0001',
  clientId: 'u1',
  riderId: 'r1',
  branchId: 'b1',
  deliveryAddress: { text: 'Av 1', latitude: 0, longitude: 0 },
  status: 'pending',
  total: 10,
  createdAt: '2026-01-01T00:00:00.000Z',
  items: [],
  statusHistory: [],
  availableTransitions: ['confirmed'],
}

const responder = (path: string): ReturnType<typeof okResponse> | undefined => {
  if (path === '/v1/me') return okResponse(rawUser)
  if (path === '/v1/users')
    return okResponse({ data: [], meta: { total: 0, limit: 20, offset: 0 } })
  if (path === '/v1/users/u1') return okResponse(rawUser)
  if (path === '/v1/carts')
    return okResponse({ id: 'c1', clientId: 'u1', status: 'active', items: [], total: 0 })
  if (path === '/v1/riders/me') return okResponse(rawRider)
  if (path === '/v1/riders/by-user/r1')
    return okResponse({ currentLocation: { latitude: -34.6, longitude: -58.4 } })
  if (path === '/v1/stock') return okResponse([])
  if (path === '/v1/orders') return okResponse({ data: [] })
  if (path === '/v1/orders/o1') return okResponse(rawOrder)
  if (path === '/v1/config/parameters') return okResponse([])
  if (path === '/v1/config/order-states') return okResponse([])
  if (path === '/v1/catalog/ingredients') return okResponse({ data: [] })
  if (path === '/v1/reporting/products/best-sellers') return okResponse([])
  return undefined
}

describe('Gateway security (e2e) — RBAC, contexto e internal token', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock((call) => responder(call.path))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    downstream.restore()
    await app.close()
  })

  beforeEach(() => downstream.reset())

  const post = (query: string, token?: string, headers: Record<string, string> = {}) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    for (const [key, value] of Object.entries(headers)) req.set(key, value)
    return req.send(gql(query))
  }

  describe('RQ-GW-06: campos protegidos sin token', () => {
    const cases: Array<{ name: string; query: string }> = [
      { name: 'myCart', query: 'query { myCart { id } }' },
      { name: 'myOrders', query: 'query { myOrders { id } }' },
      { name: 'order', query: 'query { order(id: "o1") { id } }' },
      { name: 'riderProfile', query: 'query { riderProfile { id } }' },
      { name: 'parameters', query: 'query { parameters { key } }' },
      { name: 'branchStock', query: 'query { branchStock { ingredientId } }' },
      { name: 'orderStates', query: 'query { orderStates { code } }' },
      { name: 'ingredients', query: 'query { ingredients { id } }' },
    ]

    it.each(cases)('$name sin token → UNAUTHENTICATED', async ({ query }) => {
      const res = await post(query).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('RQ-SEC-04: rol insuficiente', () => {
    const cases: Array<{ name: string; query: string; role: string }> = [
      {
        name: 'ingredients con branch_admin',
        query: 'query { ingredients { id } }',
        role: 'branch_admin',
      },
      { name: 'myCart con rider', query: 'query { myCart { id } }', role: 'rider' },
      {
        name: 'myOrders con branch_admin',
        query: 'query { myOrders { id } }',
        role: 'branch_admin',
      },
      {
        name: 'riderProfile con super_admin',
        query: 'query { riderProfile { id } }',
        role: 'super_admin',
      },
      { name: 'parameters con customer', query: 'query { parameters { key } }', role: 'customer' },
      {
        name: 'branchStock con rider',
        query: 'query { branchStock { ingredientId } }',
        role: 'rider',
      },
      {
        name: 'bestSellingProducts con customer',
        query: 'query { bestSellingProducts { position } }',
        role: 'customer',
      },
    ]

    it.each(cases)('$name → FORBIDDEN', async ({ query, role }) => {
      const token = signToken({ userId: 'u1', roles: [role] })

      const res = await post(query, token).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('token inválido o expirado', () => {
    const cases: Array<{ name: string; token: string }> = [
      { name: 'firma inválida', token: 'no-es-un-jwt' },
      {
        name: 'firma ajena',
        token: signTokenWithSecret({ userId: 'u1', roles: ['customer'] }, 'otro-secreto'),
      },
      {
        name: 'expirado',
        token: signToken({ userId: 'u1', roles: ['customer'] }, { expiresIn: -10 }),
      },
    ]

    it.each(cases)('$name → UNAUTHENTICATED', async ({ token }) => {
      const res = await post('query { me { id } }', token).expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('roles válidos', () => {
    const cases: Array<{ name: string; query: string; role: string; path: string }> = [
      {
        name: 'ingredients',
        query: 'query { ingredients { id } }',
        role: 'super_admin',
        path: '/v1/catalog/ingredients',
      },
      { name: 'myCart', query: 'query { myCart { id } }', role: 'customer', path: '/v1/carts' },
      {
        name: 'riderProfile',
        query: 'query { riderProfile { id } }',
        role: 'rider',
        path: '/v1/riders/me',
      },
      {
        name: 'branchStock',
        query: 'query { branchStock { ingredientId } }',
        role: 'branch_admin',
        path: '/v1/stock',
      },
      {
        name: 'parameters',
        query: 'query { parameters { key } }',
        role: 'super_admin',
        path: '/v1/config/parameters',
      },
      {
        name: 'myOrders',
        query: 'query { myOrders { id } }',
        role: 'customer',
        path: '/v1/orders',
      },
      {
        name: 'bestSellingProducts',
        query: 'query { bestSellingProducts { position } }',
        role: 'branch_admin',
        path: '/v1/reporting/products/best-sellers',
      },
    ]

    it.each(cases)('$name con $role → data y downstream $path', async ({ query, role, path }) => {
      const token = signToken({ userId: 'u1', roles: [role] })

      const res = await post(query, token).expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).not.toBeNull()
      expect(downstream.calls.map((call) => call.path)).toContain(path)
    })
  })

  describe('RQ-SEC-03 / RQ-GW-05: propagación de identidad y requestId', () => {
    it('reenvía userId, roles, branchId, authorization y x-request-id al servicio', async () => {
      const token = signToken({ userId: 'admin-7', roles: ['branch_admin'], branchId: 'b7' })

      await post('query { me { id } }', token, { 'X-Request-Id': 'req-fixed-1' }).expect(200)

      const [call] = downstream.calls
      expect(call.path).toBe('/v1/me')
      expect(call.headers.authorization).toBe(`Bearer ${token}`)
      expect(call.headers['x-user-id']).toBe('admin-7')
      expect(call.headers['x-user-roles']).toBe('branch_admin')
      expect(call.headers['x-branch-id']).toBe('b7')
      expect(call.headers['x-request-id']).toBe('req-fixed-1')
      expect(call.headers.accept).toBe('application/json')
    })

    it('propaga el internal token al resolver Order.client (REST → Auth)', async () => {
      const token = signToken({ userId: 'u1', roles: ['customer'] })

      await post('query { order(id: "o1") { client { id } } }', token).expect(200)

      const userCall = downstream.calls.find((call) => call.path === '/v1/users/u1')
      expect(userCall).toBeDefined()
      expect(userCall?.headers['x-internal-token']).toBe(env.internalApiToken)
      expect(userCall?.headers.authorization).toBeUndefined()
    })

    it('propaga el internal token a Delivery al resolver Order.riderLocation', async () => {
      const token = signToken({ userId: 'u1', roles: ['customer'] })

      const res = await post(
        'query { order(id: "o1") { riderLocation { latitude } } }',
        token,
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data?.order).toMatchObject({ riderLocation: { latitude: -34.6 } })
      const riderCall = downstream.calls.find((call) => call.path === '/v1/riders/by-user/r1')
      expect(riderCall?.headers['x-internal-token']).toBe(env.internalApiToken)
    })
  })
})
