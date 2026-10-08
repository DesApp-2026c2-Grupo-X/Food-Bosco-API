import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import {
  createDownstreamMock,
  DownstreamMock,
  errorResponse,
  gql,
  GraphQLBody,
  signToken,
} from './downstream'

type Service = 'auth' | 'delivery'

interface DownstreamCase {
  name: string
  query: string
  role: string
  service: Service
  restPath: string
  code: string
}

// Operaciones sin ningún caso de error downstream en graphql-downstream-errors.
const cases: DownstreamCase[] = [
  {
    name: 'registerRider',
    query:
      'mutation { registerRider(input: { firstName: "R", lastName: "R", email: "r@b.com", phone: "1", password: "password", vehicle: "Moto" }) { accessToken } }',
    role: 'super_admin',
    service: 'auth',
    restPath: '/v1/auth/register-rider',
    code: 'EMAIL_ALREADY_EXISTS',
  },
  {
    name: 'logout',
    query: 'mutation { logout }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/auth/logout',
    code: 'SESSION_NOT_FOUND',
  },
  {
    name: 'requestPasswordRecovery',
    query: 'mutation { requestPasswordRecovery(email: "a@b.com") }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/auth/password-recovery',
    code: 'USER_NOT_FOUND',
  },
  {
    name: 'resetPassword',
    query: 'mutation { resetPassword(token: "t", newPassword: "nueva-clave") }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/auth/reset-password',
    code: 'INVALID_TOKEN',
  },
  {
    name: 'users',
    query: 'query { users { data { id } } }',
    role: 'super_admin',
    service: 'auth',
    restPath: '/v1/users',
    code: 'INVALID_FILTER',
  },
  {
    name: 'myAddresses',
    query: 'query { myAddresses { id } }',
    role: 'customer',
    service: 'auth',
    restPath: '/v1/addresses',
    code: 'ADDRESS_NOT_FOUND',
  },
]

const riderProfile: DownstreamCase = {
  name: 'riderProfile',
  query: 'query { riderProfile { id } }',
  role: 'rider',
  service: 'delivery',
  restPath: '/v1/riders/me',
  code: 'RIDER_NOT_FOUND',
}

describe('Gateway errores downstream por operación (e2e) — casos restantes', () => {
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

  describe('downstream 500 sin code → INTERNAL_SERVER_ERROR', () => {
    it.each(cases)('$name', async ({ query, role, service }) => {
      downstream.setResponder(() => ({ status: 500, body: { message: 'sin code' } }))

      const res = await run(query, role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR')
      expect(body.errors?.[0].message).toBe(`${service} devolvió HTTP 500`)
    })
  })

  describe('downstream 4xx con code de dominio → propagación', () => {
    it.each(cases)('$name', async ({ query, role, restPath, code }) => {
      const message = 'Regla de negocio violada'
      downstream.setResponder(() => errorResponse(400, code, message, restPath))

      const res = await run(query, role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions).toEqual({ code, path: restPath })
    })

    it(`${riderProfile.name}`, async () => {
      const message = 'Repartidor inexistente'
      downstream.setResponder(() =>
        errorResponse(404, riderProfile.code, message, riderProfile.restPath),
      )

      const res = await run(riderProfile.query, riderProfile.role).expect(200)
      const body = res.body as GraphQLBody

      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe(message)
      expect(body.errors?.[0].extensions).toEqual({
        code: riderProfile.code,
        path: riderProfile.restPath,
      })
    })
  })
})
