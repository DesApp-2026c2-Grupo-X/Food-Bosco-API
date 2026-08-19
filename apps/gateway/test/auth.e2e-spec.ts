import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'

type Handler = (body: unknown) => unknown

const handlers: Record<string, Handler> = {
  'POST /v1/auth/login': () => ({ accessToken: 'at-login', refreshToken: 'rt-login' }),
  'POST /v1/auth/register': () => ({ accessToken: 'at-register', refreshToken: 'rt-register' }),
  'POST /v1/auth/register-rider': () => ({ accessToken: 'at-rider', refreshToken: 'rt-rider' }),
  'GET /v1/me': () => ({
    id: 'u1',
    email: 'cliente@example.com',
    firstName: 'Juan',
    lastName: 'Perez',
    phone: '11223344',
    role: 'customer',
    active: true,
    branchId: null,
    vehicle: null,
  }),
  'GET /v1/users': () => ({
    data: [
      {
        id: 'u1',
        email: 'admin@example.com',
        firstName: 'Super',
        lastName: 'Admin',
        phone: '000',
        role: 'super_admin',
        active: true,
        branchId: null,
        vehicle: null,
      },
    ],
    meta: { total: 1, limit: 20, offset: 0 },
  }),
  'GET /v1/addresses': () => ({
    data: [
      {
        id: 'a1',
        label: 'Casa',
        text: 'Av. Siempre Viva 123',
        city: 'CABA',
        postalCode: '1000',
        latitude: -34.6,
        longitude: -58.4,
        active: true,
      },
    ],
  }),
}

let originalFetch: typeof fetch

const mockFetch = (): void => {
  originalFetch = global.fetch

  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input))
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const handler = handlers[key]

    if (!handler) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ code: 'NOT_FOUND', message: 'not found', path: url.pathname }),
      } as unknown as Response
    }

    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    return { ok: true, status: 200, json: async () => handler(body) } as unknown as Response
  }) as unknown as typeof fetch
}

const gql = (query: string) => ({ query })

const sign = (payload: object): string => jwt.sign(payload, env.jwtSecret)

describe('Gateway auth (e2e) — frontend → GraphQL → REST', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    mockFetch()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    global.fetch = originalFetch
    await app.close()
  })

  it('expone el login y devuelve los tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql('mutation { login(input: { email: "a@b.com", password: "p" }) { accessToken refreshToken } }'))
      .expect(200)

    expect(res.body.data.login).toEqual({ accessToken: 'at-login', refreshToken: 'rt-login' })
  })

  it('expone el auto-registro de repartidor', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send(
        gql(
          'mutation { registerRider(input: { firstName: "R", lastName: "R", email: "r@b.com", phone: "1", password: "password", vehicle: "Moto" }) { accessToken refreshToken } }',
        ),
      )
      .expect(200)

    expect(res.body.data.registerRider).toEqual({ accessToken: 'at-rider', refreshToken: 'rt-rider' })
  })

  it('resuelve me con un JWT válido y mapea el role a enum', async () => {
    const token = sign({ userId: 'u1', roles: ['customer'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { me { id email role } }'))
      .expect(200)

    expect(res.body.data.me).toEqual({ id: 'u1', email: 'cliente@example.com', role: 'CUSTOMER' })
  })

  it('rechaza me sin token con un error de autenticación', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send(gql('query { me { id } }'))
      .expect(200)

    expect(res.body.errors).toHaveLength(1)
    expect(typeof res.body.errors[0].extensions.code).toBe('string')
    expect(res.body.data).toBeNull()
  })

  it('lista usuarios como super_admin con pageInfo', async () => {
    const token = sign({ userId: 'u9', roles: ['super_admin'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { users(filter: { role: SUPER_ADMIN }, page: { limit: 20, offset: 0 }) { data { id role } pageInfo { total limit offset } } }'))
      .expect(200)

    expect(res.body.data.users.data).toEqual([{ id: 'u1', role: 'SUPER_ADMIN' }])
    expect(res.body.data.users.pageInfo).toEqual({ total: 1, limit: 20, offset: 0 })
  })

  it('rechaza users con rol insuficiente', async () => {
    const token = sign({ userId: 'u1', roles: ['customer'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { users { data { id } pageInfo { total limit offset } } }'))
      .expect(200)

    expect(res.body.errors).toHaveLength(1)
    expect(typeof res.body.errors[0].extensions.code).toBe('string')
    expect(res.body.data).toBeNull()
  })

  it('lista las direcciones propias como customer', async () => {
    const token = sign({ userId: 'u1', roles: ['customer'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { myAddresses { id label } }'))
      .expect(200)

    expect(res.body.data.myAddresses).toEqual([{ id: 'a1', label: 'Casa' }])
  })
})
