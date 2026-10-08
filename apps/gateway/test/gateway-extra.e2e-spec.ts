import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'
import {
  createDownstreamMock,
  DownstreamMock,
  errorResponse,
  gql,
  GraphQLBody,
  okResponse,
  signToken,
} from './downstream'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

describe('Gateway extras (e2e) — throttle por operación, upload y /health', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => okResponse({}))

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

  beforeEach(() => {
    downstream.reset()
    downstream.setResponder(() => okResponse({}))
  })

  const gqlPost = (query: string, token?: string) => {
    const req = request(app.getHttpServer()).post('/graphql')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req.send(gql(query))
  }

  describe('RQ-GW-10: throttle por operación GraphQL', () => {
    it('requestPasswordRecovery permite 5 y bloquea el 6º (límite 5/60s)', async () => {
      const query = 'mutation { requestPasswordRecovery(email: "a@b.com") }'

      for (let index = 0; index < 5; index += 1) {
        const res = await gqlPost(query).expect(200)
        const body = res.body as GraphQLBody
        expect(body.errors).toBeUndefined()
        expect(body.data).toEqual({ requestPasswordRecovery: true })
      }

      const blocked = await gqlPost(query).expect(429)
      const body = blocked.body as GraphQLBody

      // INT-13: al exceder el cupo GraphQL debe responder HTTP 429 con code
      // TOO_MANY_REQUESTS, sin llamar al downstream.
      expect(blocked.status).toBe(429)
      expect(body.data).toBeNull()
      expect(body.errors).toHaveLength(1)
      expect(body.errors?.[0].message).toBe('ThrottlerException: Too Many Requests')
      expect(body.errors?.[0].extensions?.code).toBe('TOO_MANY_REQUESTS')

      expect(
        downstream.calls.filter((call) => call.path === '/v1/auth/password-recovery'),
      ).toHaveLength(5)
    })

    it('resetPassword permite 10 y bloquea el 11º (límite 10/60s)', async () => {
      const query = 'mutation { resetPassword(token: "t1", newPassword: "nueva") }'

      for (let index = 0; index < 10; index += 1) {
        const res = await gqlPost(query).expect(200)
        const body = res.body as GraphQLBody
        expect(body.errors).toBeUndefined()
        expect(body.data).toEqual({ resetPassword: true })
      }

      const blocked = await gqlPost(query).expect(429)
      const body = blocked.body as GraphQLBody

      // INT-13: el exceso de cupo responde 429 en lugar de 200.
      expect(blocked.status).toBe(429)
      expect(body.data).toBeNull()
      expect(body.errors?.[0].message).toBe('ThrottlerException: Too Many Requests')
      expect(body.errors?.[0].extensions?.code).toBe('TOO_MANY_REQUESTS')

      expect(
        downstream.calls.filter((call) => call.path === '/v1/auth/reset-password'),
      ).toHaveLength(10)
    })

    it('el tracker por Authorization es independiente dentro de /graphql', async () => {
      const query = 'mutation { requestPasswordRecovery(email: "a@b.com") }'
      const tokenA = signToken({ userId: 'client-a', roles: ['customer'] })
      const tokenB = signToken({ userId: 'client-b', roles: ['customer'] })

      for (let index = 0; index < 5; index += 1) {
        await gqlPost(query, tokenA).expect(200)
      }

      const blockedA = await gqlPost(query, tokenA).expect(429)
      expect((blockedA.body as GraphQLBody).errors?.[0].message).toBe(
        'ThrottlerException: Too Many Requests',
      )

      const allowedB = await gqlPost(query, tokenB).expect(200)
      const bodyB = allowedB.body as GraphQLBody
      expect(bodyB.errors).toBeUndefined()
      expect(bodyB.data).toEqual({ requestPasswordRecovery: true })
    })
  })

  describe('RQ-GW-13: uploads — validaciones de gateway', () => {
    const admin = () => signToken({ userId: 'admin-1', roles: ['super_admin'], branchId: 'b1' })

    it('mimetype no-imagen: 415 INVALID_IMAGE_TYPE y no llama a Commerce', async () => {
      downstream.setResponder(() => okResponse({ url: CLOUDINARY_URL }))

      const res = await request(app.getHttpServer())
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${admin()}`)
        .attach('file', Buffer.from('texto plano'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(415)

      // INT-14: el gateway rechaza con 415 INVALID_IMAGE_TYPE antes de reenviar.
      expect(res.body).toEqual({
        code: 'INVALID_IMAGE_TYPE',
        message: 'Formato de imagen no permitido',
        path: '/v1/uploads',
      })
      expect(downstream.calls).toHaveLength(0)
    })

    it('propaga el 415 INVALID_IMAGE_TYPE cuando Commerce rechaza el formato', async () => {
      downstream.setResponder(() =>
        errorResponse(
          415,
          'INVALID_IMAGE_TYPE',
          'Formato de imagen no permitido',
          '/v1/catalog/uploads',
        ),
      )

      const res = await request(app.getHttpServer())
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${admin()}`)
        .attach('file', Buffer.from('imagen'), {
          filename: 'notes.png',
          contentType: 'image/png',
        })
        .expect(415)

      expect(res.body).toEqual({
        code: 'INVALID_IMAGE_TYPE',
        message: 'Formato de imagen no permitido',
        path: '/v1/catalog/uploads',
      })
    })

    it('más de un archivo → 400 BAD_REQUEST y no llama a Commerce', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/uploads')
        .set('Authorization', `Bearer ${admin()}`)
        .attach('file', Buffer.from('a'), 'a.png')
        .attach('file', Buffer.from('b'), 'b.png')
        .expect(400)

      expect(res.body).toEqual({
        code: 'BAD_REQUEST',
        message: 'Too many files',
        path: '/v1/uploads',
      })
      expect(downstream.calls).toHaveLength(0)
    })

    it('token malformado → 401 UNAUTHENTICATED y no llama a Commerce', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/uploads')
        .set('Authorization', 'Bearer no-es-un-jwt')
        .attach('file', Buffer.from('img'), 'burger.png')
        .expect(401)

      expect(res.body).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'Unauthorized',
        path: '/v1/uploads',
      })
      expect(downstream.calls).toHaveLength(0)
    })
  })

  describe('RQ-GW-14: GET /health contrato completo', () => {
    it('devuelve status, service, uptimeSeconds, timestamp y services', async () => {
      const before = Math.floor(process.uptime())
      const res = await request(app.getHttpServer()).get('/health').expect(200)
      const body = res.body as {
        status: string
        service: string
        uptimeSeconds: number
        timestamp: string
        services: Record<string, string>
      }

      expect(body.status).toBe('ok')
      expect(body.service).toBe('gateway')
      expect(typeof body.uptimeSeconds).toBe('number')
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(before)
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
      expect(body.services).toEqual({
        auth: env.services.auth,
        commerce: env.services.commerce,
        delivery: env.services.delivery,
      })
      expect(Object.keys(body).sort()).toEqual([
        'service',
        'services',
        'status',
        'timestamp',
        'uptimeSeconds',
      ])
    })
  })
})
