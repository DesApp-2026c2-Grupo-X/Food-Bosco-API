import { HttpException } from '@nestjs/common'
import { RestClient } from './rest.client'

const fetchMock = jest.fn()
const originalFetch = global.fetch

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response

const unparsableResponse = (status: number): Response =>
  ({
    ok: false,
    status,
    json: async () => {
      throw new Error('invalid json')
    },
  }) as unknown as Response

describe('RestClient.postMultipart', () => {
  const client = new RestClient('commerce', 'http://localhost:4202')

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockReset()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('envía POST multipart con FormData, auth y query, sin forzar content-type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { url: 'http://localhost:4202/uploads/a.png' }))

    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'a.png')

    const result = await client.postMultipart<{ url: string }>('/v1/catalog/uploads', form, {
      query: { branchId: 'b1', ignored: null },
      context: {
        authorization: 'Bearer token',
        userId: 'u1',
        roles: ['super_admin'],
        branchId: 'b1',
        requestId: 'rid-1',
      },
    })

    expect(result).toEqual({ url: 'http://localhost:4202/uploads/a.png' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:4202/v1/catalog/uploads?branchId=b1')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(form)

    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer token')
    expect(headers['x-user-id']).toBe('u1')
    expect(headers['x-user-roles']).toBe('super_admin')
    expect(headers['x-branch-id']).toBe('b1')
    expect(headers['x-request-id']).toBe('rid-1')
    expect(headers['content-type']).toBeUndefined()
  })

  it('traduce un error de negocio del servicio en HttpException con su código y status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(415, {
        code: 'INVALID_IMAGE_TYPE',
        message: 'Formato de imagen no permitido',
        path: '/v1/catalog/uploads',
      }),
    )

    const error = await client
      .postMultipart('/v1/catalog/uploads', new FormData())
      .catch((thrown) => thrown)

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(415)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INVALID_IMAGE_TYPE',
      message: 'Formato de imagen no permitido',
      path: '/v1/catalog/uploads',
    })
  })

  it('sin cuerpo de error parseable → HttpException INTERNAL_SERVER_ERROR', async () => {
    fetchMock.mockResolvedValue(unparsableResponse(500))

    const error = await client
      .postMultipart('/v1/catalog/uploads', new FormData())
      .catch((thrown) => thrown)

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      path: '/v1/catalog/uploads',
    })
  })
})
