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
  jsonResponse,
  signToken,
} from './downstream'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

describe('Gateway uploads extendido (e2e) — multipart → Commerce REST', () => {
  let app: INestApplication<App>
  let downstream: DownstreamMock

  beforeAll(async () => {
    downstream = createDownstreamMock(() => jsonResponse(201, { url: CLOUDINARY_URL }))

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

  const upload = (token: string, headers: Record<string, string> = {}) => {
    const req = request(app.getHttpServer())
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${token}`)
    for (const [key, value] of Object.entries(headers)) req.set(key, value)
    return req.attach('file', Buffer.from('fake-image'), 'burger.png')
  }

  const admin = () => signToken({ userId: 'admin-1', roles: ['super_admin'], branchId: 'b1' })

  const commerceCall = (): DownstreamCall => {
    const call = downstream.calls.find((entry) => entry.path === '/v1/catalog/uploads')
    if (!call) {
      throw new Error('No hubo llamada a Commerce')
    }
    return call
  }

  it('propaga identidad, requestId y multipart a Commerce', async () => {
    const token = admin()
    const res = await upload(token, { 'X-Request-Id': 'req-up-1' }).expect(201)

    expect(res.body).toEqual({ url: CLOUDINARY_URL })
    const call = commerceCall()
    expect(call.method).toBe('POST')
    expect(call.rawBody).toBeInstanceOf(FormData)
    expect((call.rawBody as FormData).get('file')).toBeInstanceOf(Blob)
    expect(call.headers.authorization).toBe(`Bearer ${token}`)
    expect(call.headers['x-user-id']).toBe('admin-1')
    expect(call.headers['x-user-roles']).toBe('super_admin')
    expect(call.headers['x-branch-id']).toBe('b1')
    expect(call.headers['x-request-id']).toBe('req-up-1')
    expect(call.headers['content-type']).toBeUndefined()
  })

  const statusCases: Array<{ status: number; code: string; message: string }> = [
    { status: 400, code: 'INVALID_IMAGE', message: 'Imagen inválida' },
    { status: 401, code: 'UNAUTHENTICATED', message: 'Token expirado' },
    { status: 403, code: 'FORBIDDEN', message: 'Sin permiso' },
    { status: 404, code: 'NOT_FOUND', message: 'Ruta inexistente' },
    { status: 409, code: 'DUPLICATE_IMAGE', message: 'Imagen duplicada' },
  ]

  it.each(statusCases)(
    'propaga error downstream $status → $code',
    async ({ status, code, message }) => {
      downstream.setResponder(() => errorResponse(status, code, message, '/v1/catalog/uploads'))

      const res = await upload(admin()).expect(status)

      expect(res.body).toEqual({ code, message, path: '/v1/uploads' })
      // KNOWN BUG (RQ-GW-07): UploadExceptionFilter sobreescribe el `path` con la URL del
      // gateway; el `path` del servicio (`/v1/catalog/uploads`) no se propaga.
    },
  )

  it('500 sin code → INTERNAL_SERVER_ERROR con mensaje de servicio', async () => {
    downstream.setResponder(() => jsonResponse(500, { message: 'sin code' }))

    const res = await upload(admin()).expect(500)

    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR')
    expect(res.body.message).toBe('commerce devolvió HTTP 500')
  })
})
