import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
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

type HandlerMap = Record<string, unknown>

const respondWith = (handlers: HandlerMap) => (call: { method: string; path: string }) => {
  const key = `${call.method} ${call.path}`
  return key in handlers ? okResponse(handlers[key]) : undefined
}

describe('Gateway auth extendido (e2e) — gaps de updateUser, users, user y direcciones', () => {
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

  const admin = () => signToken({ userId: 'admin-1', roles: ['super_admin'] })
  const customer = () => signToken({ userId: 'u1', roles: ['customer'] })

  const callFor = (method: string, path: string): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.method === method && entry.path === path)
    if (!call) {
      throw new Error(`No hubo llamada downstream ${method} ${path}`)
    }
    return call
  }

  describe('updateUser (mutation super_admin)', () => {
    it('PATCH /v1/users/{id} reenvía el input y remapea el usuario', async () => {
      downstream.setResponder(
        respondWith({ 'PATCH /v1/users/u9': { ...rawUser, firstName: 'Pedro' } }),
      )

      const res = await post(
        'mutation { updateUser(id: "u9", input: { firstName: "Pedro", lastName: "Q", phone: "9", branchId: "b2" }) { id firstName role branchId } }',
        admin(),
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        updateUser: { id: 'u9', firstName: 'Pedro', role: 'BRANCH_ADMIN', branchId: 'b1' },
      })
      const call = callFor('PATCH', '/v1/users/u9')
      expect(call.body).toEqual({ firstName: 'Pedro', lastName: 'Q', phone: '9', branchId: 'b2' })
    })

    it.each([
      { status: 404, code: 'USER_NOT_FOUND', message: 'Usuario inexistente' },
      { status: 400, code: 'BAD_REQUEST', message: 'Solicitud inválida' },
      { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'El email ya está registrado' },
    ])('propaga HTTP $status $code con code/message/path', async ({ status, code, message }) => {
      downstream.setResponder(() => errorResponse(status, code, message, '/v1/users/u9'))

      const res = await post(
        'mutation { updateUser(id: "u9", input: { firstName: "Pedro" }) { id } }',
        admin(),
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions).toEqual({ code, path: '/v1/users/u9' })
      expect(body.errors?.[0].path).toEqual(['updateUser'])
    })

    it('sin token → UNAUTHENTICATED', async () => {
      const res = await post(
        'mutation { updateUser(id: "u9", input: { firstName: "P" }) { id } }',
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(body.errors?.[0].message).toBe('Unauthorized')
      expect(downstream.calls).toHaveLength(0)
    })

    it('con rol customer → FORBIDDEN', async () => {
      const res = await post(
        'mutation { updateUser(id: "u9", input: { firstName: "P" }) { id } }',
        customer(),
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('users (query super_admin)', () => {
    it('traduce filtros (incluye active=false) y pagina', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/users': {
            data: [{ ...rawUser, role: 'rider' }],
            meta: { total: 1, limit: 5, offset: 10 },
          },
        }),
      )

      const res = await post(
        'query { users(filter: { role: RIDER, active: false, search: "juan" }, page: { limit: 5, offset: 10 }) { data { id role } pageInfo { total limit offset } } }',
        admin(),
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        users: {
          data: [{ id: 'u9', role: 'RIDER' }],
          pageInfo: { total: 1, limit: 5, offset: 10 },
        },
      })
      const params = queryParams(callFor('GET', '/v1/users').url)
      expect(params.get('role')).toBe('rider')
      expect(params.get('active')).toBe('false')
      expect(params.get('search')).toBe('juan')
      expect(params.get('limit')).toBe('5')
      expect(params.get('offset')).toBe('10')
    })

    it('paginación por defecto no envía filtros ni page al downstream', async () => {
      downstream.setResponder(
        respondWith({
          'GET /v1/users': { data: [rawUser], meta: { total: 1, limit: 20, offset: 0 } },
        }),
      )

      const res = await post(
        'query { users { data { id } pageInfo { total limit offset } } }',
        admin(),
      ).expect(200)

      expect((res.body as GraphQLBody).data).toEqual({
        users: { data: [{ id: 'u9' }], pageInfo: { total: 1, limit: 20, offset: 0 } },
      })
      const params = queryParams(callFor('GET', '/v1/users').url)
      expect([...params.keys()]).toEqual([])
    })

    it('sin token → UNAUTHENTICATED', async () => {
      const res = await post('query { users { data { id } } }').expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('UNAUTHENTICATED')
      expect(downstream.calls).toHaveLength(0)
    })

    it.each(['customer', 'branch_admin'])('con rol %s → FORBIDDEN', async (role) => {
      const res = await post(
        'query { users { data { id } } }',
        signToken({ userId: 'u1', roles: [role] }),
      ).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('FORBIDDEN')
      expect(body.errors?.[0].message).toBe('Forbidden')
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('user (query super_admin)', () => {
    it('propaga 404 USER_NOT_FOUND', async () => {
      downstream.setResponder(() =>
        errorResponse(404, 'USER_NOT_FOUND', 'Usuario inexistente', '/v1/users/x'),
      )

      const res = await post('query { user(id: "x") { id } }', admin()).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe('Usuario inexistente')
      expect(body.errors?.[0].extensions).toEqual({ code: 'USER_NOT_FOUND', path: '/v1/users/x' })
      expect(body.errors?.[0].path).toEqual(['user'])
    })

    it('propaga un 5xx downstream sin code como INTERNAL_SERVER_ERROR', async () => {
      downstream.setResponder(() => ({ status: 500, body: { message: 'sin code' } }))

      const res = await post('query { user(id: "x") { id } }', admin()).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR')
      expect(body.errors?.[0].message).toBe('auth devolvió HTTP 500')
    })
  })

  describe('propagación de errores downstream (auth)', () => {
    interface ErrorCase {
      name: string
      query: string
      role: string
      method: 'GET' | 'PATCH' | 'POST'
      path: string
      status: number
      code: string
      message: string
      field: string
    }

    const cases: ErrorCase[] = [
      {
        name: 'updateProfile 400',
        query:
          'mutation { updateProfile(input: { firstName: "A", lastName: "B", phone: "1" }) { id } }',
        role: 'customer',
        method: 'PATCH',
        path: '/v1/me',
        status: 400,
        code: 'INVALID_PROFILE',
        message: 'Perfil inválido',
        field: 'updateProfile',
      },
      {
        name: 'updateProfile 404',
        query:
          'mutation { updateProfile(input: { firstName: "A", lastName: "B", phone: "1" }) { id } }',
        role: 'customer',
        method: 'PATCH',
        path: '/v1/me',
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'Usuario inexistente',
        field: 'updateProfile',
      },
      {
        name: 'me 404',
        query: 'query { me { id } }',
        role: 'customer',
        method: 'GET',
        path: '/v1/me',
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'Usuario inexistente',
        field: 'me',
      },
      {
        name: 'createStaff 400',
        query:
          'mutation { createStaff(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", branchId: "b1" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/staff',
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Solicitud inválida',
        field: 'createStaff',
      },
      {
        name: 'createStaff 409',
        query:
          'mutation { createStaff(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", branchId: "b1" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/staff',
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'El email ya está registrado',
        field: 'createStaff',
      },
      {
        name: 'createAdmin 400',
        query:
          'mutation { createAdmin(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/admins',
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Solicitud inválida',
        field: 'createAdmin',
      },
      {
        name: 'createAdmin 409',
        query:
          'mutation { createAdmin(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/admins',
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'El email ya está registrado',
        field: 'createAdmin',
      },
      {
        name: 'createRider 400',
        query:
          'mutation { createRider(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", vehicle: "Moto" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/riders',
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Solicitud inválida',
        field: 'createRider',
      },
      {
        name: 'createRider 409',
        query:
          'mutation { createRider(input: { firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "p", vehicle: "Moto" }) { id } }',
        role: 'super_admin',
        method: 'POST',
        path: '/v1/users/riders',
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'El email ya está registrado',
        field: 'createRider',
      },
    ]

    it.each(cases)(
      '$name propaga code/message/path de $path',
      async ({ query, role, method, path, status, code, message, field }) => {
        downstream.setResponder(() => errorResponse(status, code, message, path))

        const res = await post(query, signToken({ userId: 'u1', roles: [role] })).expect(200)
        const body = res.body as GraphQLBody

        expect(body.data).toBeNull()
        expect(body.errors).toHaveLength(1)
        expect(body.errors?.[0].message).toBe(message)
        expect(body.errors?.[0].extensions).toEqual({ code, path })
        expect(body.errors?.[0].path).toEqual([field])
        expect(callFor(method, path)).toBeDefined()
      },
    )
  })

  describe('direcciones (customer)', () => {
    it('address(id) propaga 404 ADDRESS_NOT_FOUND', async () => {
      downstream.setResponder(() =>
        errorResponse(404, 'ADDRESS_NOT_FOUND', 'Dirección inexistente', '/v1/addresses/a1'),
      )

      const res = await post('query { address(id: "a1") { id } }', customer()).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors?.[0].message).toBe('Dirección inexistente')
      expect(body.errors?.[0].extensions).toEqual({
        code: 'ADDRESS_NOT_FOUND',
        path: '/v1/addresses/a1',
      })
      expect(body.errors?.[0].path).toEqual(['address'])
    })

    it.each([
      {
        name: 'updateAddress 404',
        query: 'mutation { updateAddress(id: "a1", input: { label: "Trabajo" }) { id } }',
        method: 'PATCH' as const,
        status: 404,
        code: 'ADDRESS_NOT_FOUND',
        message: 'Dirección inexistente',
      },
      {
        name: 'updateAddress ownership 403',
        query: 'mutation { updateAddress(id: "a1", input: { label: "Trabajo" }) { id } }',
        method: 'PATCH' as const,
        status: 403,
        code: 'ADDRESS_FORBIDDEN',
        message: 'No podés modificar una dirección ajena',
      },
      {
        name: 'deleteAddress 404',
        query: 'mutation { deleteAddress(id: "a1") }',
        method: 'DELETE' as const,
        status: 404,
        code: 'ADDRESS_NOT_FOUND',
        message: 'Dirección inexistente',
      },
      {
        name: 'deleteAddress ownership 403',
        query: 'mutation { deleteAddress(id: "a1") }',
        method: 'DELETE' as const,
        status: 403,
        code: 'ADDRESS_FORBIDDEN',
        message: 'No podés modificar una dirección ajena',
      },
    ])('$name propaga $code', async ({ query, method, status, code, message }) => {
      downstream.setResponder(() => errorResponse(status, code, message, '/v1/addresses/a1'))

      const res = await post(query, customer()).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions).toEqual({ code, path: '/v1/addresses/a1' })
      expect(callFor(method, '/v1/addresses/a1')).toBeDefined()
    })

    it('myAddresses devuelve lista vacía', async () => {
      downstream.setResponder(respondWith({ 'GET /v1/addresses': { data: [] } }))

      const res = await post('query { myAddresses { id } }', customer()).expect(200)
      const body = res.body as GraphQLBody

      expect(body.errors).toBeUndefined()
      expect(body.data).toEqual({ myAddresses: [] })
    })
  })
})
