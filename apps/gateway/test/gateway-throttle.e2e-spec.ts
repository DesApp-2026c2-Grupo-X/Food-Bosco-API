import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'
import { signToken } from './downstream'

const LIMIT = env.throttle.limit

describe('Gateway rate limiting (e2e) — RQ-GW-10', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const health = (token?: string) => {
    const req = request(app.getHttpServer()).get('/health')
    if (token) req.set('Authorization', `Bearer ${token}`)
    return req
  }

  it('permite LIMIT requests y responde 429 en la siguiente (tracker anónimo)', async () => {
    for (let index = 0; index < LIMIT; index += 1) {
      await health().expect(200)
    }

    const blocked = await health().expect(429)
    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    })
  }, 120_000)

  it('el tracker por token es independiente entre clientes', async () => {
    const tokenA = signToken({ userId: 'client-a', roles: ['customer'] })
    const tokenB = signToken({ userId: 'client-b', roles: ['customer'] })

    for (let index = 0; index < LIMIT; index += 1) {
      await health(tokenA).expect(200)
    }

    await health(tokenA).expect(429)
    await health(tokenB).expect(200)
  }, 120_000)
})
