import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { env } from '../src/config/env'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

interface CommerceCall {
  path: string
  method: string
  headers: Record<string, string>
}

interface CommerceResponse {
  ok: boolean
  status: number
  body: unknown
}

let originalFetch: typeof fetch
let commerceResponse: CommerceResponse
let commerceCalls: CommerceCall[]

const mockFetch = (): void => {
  originalFetch = global.fetch

  global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input))
    commerceCalls.push({
      path: url.pathname,
      method: init?.method ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
    })

    return {
      ok: commerceResponse.ok,
      status: commerceResponse.status,
      json: async () => commerceResponse.body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

const sign = (payload: object): string => jwt.sign(payload, env.jwtSecret)

const upload = (
  app: INestApplication<App>,
  token?: string,
  contents: Buffer = Buffer.from('fake-image'),
) => {
  const req = request(app.getHttpServer()).post('/v1/uploads')
  if (token) req.set('Authorization', `Bearer ${token}`)
  return req.attach('file', contents, 'burger.png')
}

describe('Gateway uploads (e2e) — multipart → Commerce REST', () => {
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

  beforeEach(() => {
    commerceCalls = []
    commerceResponse = {
      ok: true,
      status: 201,
      body: { url: CLOUDINARY_URL },
    }
  })

  it('super_admin: sube la imagen y devuelve la URL de Commerce', async () => {
    const token = sign({ userId: 'admin-1', roles: ['super_admin'] })

    const res = await upload(app, token).expect(201)

    expect(res.body).toEqual({ url: CLOUDINARY_URL })
    expect(commerceCalls).toHaveLength(1)
    expect(commerceCalls[0].method).toBe('POST')
    expect(commerceCalls[0].path).toBe('/v1/catalog/uploads')
    expect(commerceCalls[0].headers.authorization).toBe(`Bearer ${token}`)
  })

  it('super_admin sin archivo: 400 IMAGE_REQUIRED y no llama a Commerce', async () => {
    const token = sign({ userId: 'admin-1', roles: ['super_admin'] })

    const res = await request(app.getHttpServer())
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(res.body.code).toBe('IMAGE_REQUIRED')
    expect(commerceCalls).toHaveLength(0)
  })

  it('customer: 403 FORBIDDEN con envelope y no llama a Commerce', async () => {
    const token = sign({ userId: 'c1', roles: ['customer'] })

    const res = await upload(app, token).expect(403)

    expect(res.body.code).toBe('FORBIDDEN')
    expect(commerceCalls).toHaveLength(0)
  })

  it('sin token: 401 UNAUTHENTICATED con envelope y no llama a Commerce', async () => {
    const res = await upload(app).expect(401)

    expect(res.body.code).toBe('UNAUTHENTICATED')
    expect(commerceCalls).toHaveLength(0)
  })

  it('archivo que supera el límite del gateway: 413 PAYLOAD_TOO_LARGE', async () => {
    const token = sign({ userId: 'admin-1', roles: ['super_admin'] })

    const res = await upload(app, token, Buffer.alloc(env.uploads.maxSizeBytes + 1)).expect(413)

    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE')
    expect(commerceCalls).toHaveLength(0)
  })

  it('propaga el error de Commerce (413)', async () => {
    const token = sign({ userId: 'admin-1', roles: ['super_admin'] })
    commerceResponse = {
      ok: false,
      status: 413,
      body: {
        code: 'IMAGE_TOO_LARGE',
        message: 'La imagen supera el tamaño máximo permitido',
        path: '/v1/catalog/uploads',
      },
    }

    const res = await upload(app, token).expect(413)

    expect(res.body.code).toBe('IMAGE_TOO_LARGE')
  })
})
