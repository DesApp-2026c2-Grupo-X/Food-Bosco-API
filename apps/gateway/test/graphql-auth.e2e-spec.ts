import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
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

const rawUser = {
  id: 'u9',
  email: 'user@example.com',
  firstName: 'Ana',
  lastName: 'Lopez',
  phone: '555',
  role: 'branch_admin',
  active: true,
  branchId: 'b1',
  vehicle: null,
}

const rawAddress = {
  id: 'a1',
  label: 'Casa',
  text: 'Av. Siempre Viva 123',
  city: 'CABA',
  postalCode: '1000',
  latitude: -34.6,
  longitude: -58.4,
  active: true,
}

type HandlerMap = Record<string, unknown>

const respondWith =
  (handlers: HandlerMap) =>
  (call: { method: string; path: string }) => {
    const key = `${call.method} ${call.path}`
    return key in handlers ? okResponse(handlers[key]) : undefined
  }

describe('Gateway auth extendido (e2e) — frontend → GraphQL → REST', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => undefined)

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

  const post = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req.send(gql(query))
  }

  const customer = () => signToken({ userId: 'u1', roles: ['customer'] })
  const admin = () => signToken({ userId: 'admin-1', roles: ['super_admin'] })

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('mutaciones públicas', () => {
    it('register reenvía el input y devuelve tokens', async () => {
      downstream.setResponder(
        respondWith({ 'POST /v1/auth/register': { accessToken: 'at', refreshToken: 'rt' } }),
      )

      const res = await post(
        'mutation { register(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { accessToken refreshToken } }',
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        register: { accessToken: 'at', refreshToken: 'rt' },
      })
      expect(callFor('POST', '/v1/auth/register').body).toEqual({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        phone: '1',
        password: 'p',
      })
    })

    it.each([
      {
        name: 'refreshToken',
        query: 'mutation { refreshToken(refreshToken: "rt-1") { accessToken } }',
        path: '/v1/auth/refresh',
        body: { refreshToken: 'rt-1' },
      },
      {
        name: 'requestPasswordRecovery',
        query: 'mutation { requestPasswordRecovery(email: "a@b.com") }',
        path: '/v1/auth/password-recovery',
        body: { email: 'a@b.com' },
      },
      {
        name: 'resetPassword',
        query: 'mutation { resetPassword(token: "t1", newPassword: "nueva") }',
        path: '/v1/auth/reset-password',
        body: { token: 't1', newPassword: 'nueva' },
      },
    ])('$name mapea el body REST', async ({ query, path, body }) => {
      downstream.setResponder(respondWith({ [`POST ${path}`]: { accessToken: 'at', refreshToken: 'rt' } }))

      const res = await post(query).expect(200)

      expect((res.body as GraphQLBody).errors).toBeUndefined()
      expect(callFor('POST', path).body).toEqual(body)
    })
  })

  describe('sesión autenticada', () => {
    it('logout reenvía el contexto de identidad', async () => {
      downstream.setResponder(respondWith({ 'POST /v1/auth/logout': {} }))
      const token = customer()

      const res = await post('mutation { logout }', token).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ logout: true })
      const call = callFor('POST', '/v1/auth/logout')
      expect(call.headers.authorization).toBe(`Bearer ${token}`)
      expect(call.headers['x-user-id']).toBe('u1')
      expect(call.headers['x-user-roles']).toBe('customer')
    })

    it('updateProfile hace PATCH /v1/me y remapea el usuario', async () => {
      downstream.setResponder(
        respondWith({ 'PATCH /v1/me': { ...rawUser, firstName: 'Pedro', role: 'customer' } }),
      )

      const res = await post(
        'mutation { updateProfile(input: { firstName: "Pedro", lastName: "Q", phone: "9" }) { firstName phone } }',
        customer(),
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        updateProfile: { firstName: 'Pedro', phone: '555' },
      })
      expect(callFor('PATCH', '/v1/me').body).toEqual({
        firstName: 'Pedro',
        lastName: 'Q',
        phone: '9',
      })
    })
  })

  describe('administración de usuarios', () => {
    it('user(id) hace GET /v1/users/{id} y mapea el rol', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/users/u9': rawUser }))

      const res = await post('query { user(id: "u9") { id email role branchId } }', admin()).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        user: { id: 'u9', email: 'user@example.com', role: 'BRANCH_ADMIN', branchId: 'b1' },
      })
    })

    it.each([
      {
        name: 'createStaff',
        query:
          'mutation { createStaff(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", branchId: "b1" }) { id role } }',
        path: '/v1/users/staff',
        body: { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '1', password: 'p', branchId: 'b1' },
        role: 'branch_admin',
      },
      {
        name: 'createAdmin',
        query:
          'mutation { createAdmin(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { id role } }',
        path: '/v1/users/admins',
        body: { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '1', password: 'p' },
        role: 'super_admin',
      },
      {
        name: 'createRider',
        query:
          'mutation { createRider(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", vehicle: "Moto" }) { id role } }',
        path: '/v1/users/riders',
        body: { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '1', password: 'p', vehicle: 'Moto' },
        role: 'rider',
      },
    ])('$name reenvía el input al endpoint REST', async ({ query, path, body, role }) => {
      downstream.setResponder(respondWith({ [`POST ${path}`]: { ...rawUser, role } }))

      const res = await post(query, admin()).expect(200)

      expect((res.body as GraphQLBody).data).toBeDefined()
      expect(callFor('POST', path).body).toEqual(body)
    })

    it('setUserActive hace PATCH y traduce el flag', async () => {
      downstream.setResponder(respondWith({ 'PATCH /v1/users/u9/active': { ...rawUser, active: false } }))

      const res = await post('mutation { setUserActive(id: "u9", active: false) { id active } }', admin()).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ setUserActive: { id: 'u9', active: false } })
      expect(callFor('PATCH', '/v1/users/u9/active').body).toEqual({ active: false })
    })

    it('users filtra por rol enum→snake y pagina con limit/offset', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/users': { data: [rawUser], meta: { total: 1, limit: 5, offset: 10 } },
        }),
      )

      const res = await post(
        'query { users(filter: { role: BRANCH_ADMIN, active: true, search: "ana" }, page: { limit: 5, offset: 10 }) { data { id role } pageInfo { total limit offset } } }',
        admin(),
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        users: {
          data: [{ id: 'u9', role: 'BRANCH_ADMIN' }],
          pageInfo: { total: 1, limit: 5, offset: 10 },
        },
      })
      const params = queryParams(callFor('GET', '/v1/users').url)
      expect(params.get('role')).toBe('branch_admin')
      expect(params.get('active')).toBe('true')
      expect(params.get('search')).toBe('ana')
      expect(params.get('limit')).toBe('5')
      expect(params.get('offset')).toBe('10')
    })

    const roleCases: Array<{ role: string; expected: string }> = [
      { role: 'customer', expected: 'CUSTOMER' },
      { role: 'branch_admin', expected: 'BRANCH_ADMIN' },
      { role: 'super_admin', expected: 'SUPER_ADMIN' },
      { role: 'rider', expected: 'RIDER' },
    ]

    it.each(roleCases)('mapea el rol $role a $expected', async ({ role, expected }) => {
      downstream.setResponder(respondWith({ 'GET /v1/users/u9': { ...rawUser, role } }))

      const res = await post('query { user(id: "u9") { role } }', admin()).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({ user: { role: expected } })
    })
  })

  describe('direcciones (customer)', () => {
    it.each([
      {
        name: 'address',
        query: 'query { address(id: "a1") { id label city latitude longitude } }',
        method: 'GET',
        path: '/v1/addresses/a1',
        body: undefined,
        expected: { address: { id: 'a1', label: 'Casa', city: 'CABA', latitude: -34.6, longitude: -58.4 } },
      },
      {
        name: 'createAddress',
        query:
          'mutation { createAddress(input: { label: "Casa", text: "Av 1", latitude: -34.6, longitude: -58.4 }) { id label } }',
        method: 'POST',
        path: '/v1/addresses',
        body: { label: 'Casa', text: 'Av 1', latitude: -34.6, longitude: -58.4 },
        expected: { createAddress: { id: 'a1', label: 'Casa' } },
      },
      {
        name: 'updateAddress',
        query: 'mutation { updateAddress(id: "a1", input: { label: "Trabajo" }) { id label } }',
        method: 'PATCH',
        path: '/v1/addresses/a1',
        body: { label: 'Trabajo' },
        expected: { updateAddress: { id: 'a1', label: 'Casa' } },
      },
      {
        name: 'deleteAddress',
        query: 'mutation { deleteAddress(id: "a1") }',
        method: 'DELETE',
        path: '/v1/addresses/a1',
        body: undefined,
        expected: { deleteAddress: true },
      },
    ])('$name usa $method $path', async ({ query, method, path, body, expected }) => {
      downstream.setResponder(respondWith({ [`${method} ${path}`]: rawAddress }))

      const res = await post(query, customer()).expect(200)

      expect((res.body as GraphQLBody).data).toEqual(expected)
      const call = callFor(method, path)
      if (body !== undefined) {
        expect(call.body).toEqual(body)
      }
    })
  })
})
