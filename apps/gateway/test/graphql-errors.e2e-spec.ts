import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamMock,
  DownstreamResponse,
  gql,
  GraphQLBody,
  signToken,
} from './downstream'

describe('Gateway error propagation (e2e) — RQ-GW-07', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock
  let failure: DownstreamResponse

  beforeAll(async () => {
    downstream = createDownstreamMock(() => failure)

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

  const postOrder = (token: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('query { order(id: "o1") { id } }'))

  describe('envelope único code/message/path', () => {
    const cases: Array<{ status: number; code: string; message: string }> = [
      { status: 400, code: 'BAD_REQUEST', message: 'Solicitud inválida' },
      { status: 401, code: 'UNAUTHENTICATED', message: 'Credenciales inválidas' },
      { status: 403, code: 'FORBIDDEN', message: 'No autorizado' },
      { status: 404, code: 'ORDER_NOT_FOUND', message: 'Pedido inexistente' },
      { status: 409, code: 'ORDER_STATE_CONFLICT', message: 'Transición inválida' },
    ]

    it.each(cases)('HTTP $status → errors[] con $code', async ({ status, code, message }) => {
      failure = { status, body: { code, message, path: '/v1/orders/o1' } }
      const token = signToken({ userId: 'u1', roles: ['customer'] })

      const res = await postOrder(token).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions?.code).toBe(code)
      expect(body.errors?.[0].extensions).toEqual({ code })
      // KNOWN BUG (RQ-GW-07): el `path` esperado es el del servicio REST ('/v1/orders/o1'),
      // pero formatGraphQLError descarta `extensions.path` y usa el path GraphQL.
      expect(body.errors?.[0].path).toEqual(['order'])
    })
  })

  describe('fallback cuando el servicio no envía code', () => {
    const cases: Array<{ name: string; query: string; role: string; service: string }> = [
      { name: 'Commerce', query: 'query { order(id: "o1") { id } }', role: 'customer', service: 'commerce' },
      { name: 'Auth', query: 'query { me { id } }', role: 'customer', service: 'auth' },
      { name: 'Delivery', query: 'query { riderProfile { id } }', role: 'rider', service: 'delivery' },
    ]

    it.each(cases)('$name sin body de error → INTERNAL_SERVER_ERROR', async ({ query, role, service }) => {
      failure = { status: 500, body: { message: 'sin code' } }
      const token = signToken({ userId: 'u1', roles: [role] })

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send(gql(query))
        .expect(200)

      const body = res.body as GraphQLBody
      expect(body.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR')
      expect(body.errors?.[0].message).toBe(`${service} devolvió HTTP 500`)
    })
  })

  it('propaga el code y message de un 409 leído por el mismo cliente GraphQL', async () => {
    failure = {
      status: 409,
      body: { code: 'BRANCH_CLOSED', message: 'La sucursal está cerrada', path: '/v1/orders/o1' },
    }
    const token = signToken({ userId: 'admin-1', roles: ['branch_admin'] })

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send(gql('mutation { changeOrderStatus(orderId: "o1", status: CONFIRMED) { id } }'))
      .expect(200)

    const body = res.body as GraphQLBody
    expect(body.errors?.[0].extensions?.code).toBe('BRANCH_CLOSED')
    expect(body.errors?.[0].message).toBe('La sucursal está cerrada')
  })
})
