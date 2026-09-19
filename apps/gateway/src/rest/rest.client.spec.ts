import { HttpException } from '@nestjs/common'
import { GraphQLError } from 'graphql'
import { RestClient } from './rest.client'

const fetchMock = jest.fn()
const originalFetch = global.fetch

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response

const emptyBodyResponse = (status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    },
  }) as unknown as Response

const callAndCatch = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error)

type MethodCase = {
  name: string
  method: string
  call: (client: RestClient) => Promise<unknown>
}

describe('RestClient.request', () => {
  const client = new RestClient('commerce', 'http://localhost:4202')

  const methodCases: MethodCase[] = [
    { name: 'get', method: 'GET', call: (rest) => rest.get('/v1/things') },
    { name: 'post', method: 'POST', call: (rest) => rest.post('/v1/things') },
    { name: 'patch', method: 'PATCH', call: (rest) => rest.patch('/v1/things') },
    { name: 'put', method: 'PUT', call: (rest) => rest.put('/v1/things') },
    { name: 'delete', method: 'DELETE', call: (rest) => rest.delete('/v1/things') },
  ]

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockReset()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it.each(methodCases)('$name → $method y devuelve el JSON parseado', async ({ call, method }) => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    const result = await call(client)

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:4202/v1/things')
    expect(init.method).toBe(method)
    expect(init.body).toBeUndefined()
  })

  it('construye la URL con query params, omite null/undefined y codifica espacios', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await client.get('/v1/catalog/products', {
      query: {
        categoryId: 'c1',
        search: 'a b',
        available: false,
        limit: 5,
        offset: 0,
        nope: null,
        missing: undefined,
      },
    })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'http://localhost:4202/v1/catalog/products?categoryId=c1&search=a+b&available=false&limit=5&offset=0',
    )
  })

  it.each([
    { name: 'sin query', path: '/v1/me', query: undefined, expected: 'http://localhost:4202/v1/me' },
    {
      name: 'con query vacía',
      path: '/v1/me',
      query: {},
      expected: 'http://localhost:4202/v1/me',
    },
    {
      name: 'con todos los valores nulos',
      path: '/v1/me',
      query: { a: null, b: undefined },
      expected: 'http://localhost:4202/v1/me',
    },
  ])('$name → $expected', async ({ path, query, expected }) => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await client.get(path, { query })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(expected)
  })

  it('serializa el body a JSON y solo entonces agrega content-type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, {}))
    await client.post('/v1/orders', { body: { a: 1, nested: { b: 2 } } })

    const withBody = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(withBody[1].body).toBe('{"a":1,"nested":{"b":2}}')
    expect((withBody[1].headers as Record<string, string>)['content-type']).toBe('application/json')

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await client.post('/v1/orders')

    const withoutBody = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(withoutBody[1].body).toBeUndefined()
    expect((withoutBody[1].headers as Record<string, string>)['content-type']).toBeUndefined()
  })

  it('propaga el contexto completo en headers (RQ-SEC-03)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))

    await client.get('/v1/me', {
      context: {
        authorization: 'Bearer token',
        userId: 'u1',
        roles: ['branch_admin', 'customer'],
        branchId: 'b1',
        requestId: 'rid-1',
        internalToken: 'internal-1',
      },
    })

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers).toEqual({
      accept: 'application/json',
      authorization: 'Bearer token',
      'x-user-id': 'u1',
      'x-user-roles': 'branch_admin,customer',
      'x-branch-id': 'b1',
      'x-request-id': 'rid-1',
      'x-internal-token': 'internal-1',
    })
  })

  it('con contexto ausente o vacío solo envía accept', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await client.get('/v1/me')

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await client.get('/v1/me', {
      context: { authorization: '', userId: '', roles: [], branchId: null, requestId: '', internalToken: '' },
    })

    const headers = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>
    expect(headers).toEqual({ accept: 'application/json' })
  })

  it('204 con cuerpo vacío: response.json() rechaza y propaga un SyntaxError crudo', async () => {
    fetchMock.mockResolvedValue(emptyBodyResponse(204))

    // KNOWN BUG (latente): RestClient siempre hace response.json() y no contempla 204/empty body;
    // si un servicio responde 204, el gateway lanza un SyntaxError crudo en vez de resolver.
    await expect(client.delete('/v1/addresses/a1')).rejects.toBeInstanceOf(SyntaxError)
  })

  describe('mapeo de errores no-2xx a GraphQLError', () => {
    const cases: Array<{
      name: string
      status: number
      body: unknown
      unparsable?: boolean
      code: string
      message: string
      path: string
    }> = [
      {
        name: 'usa code/message/path del servicio',
        status: 404,
        body: { code: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado', path: '/v1/orders/9' },
        code: 'ORDER_NOT_FOUND',
        message: 'Pedido no encontrado',
        path: '/v1/orders/9',
      },
      {
        name: 'sin path usa el path del request',
        status: 409,
        body: { code: 'ORDER_STATE_CONFLICT', message: 'Estado inválido' },
        code: 'ORDER_STATE_CONFLICT',
        message: 'Estado inválido',
        path: '/v1/orders/9',
      },
      {
        name: 'sin message usa un mensaje genérico con el nombre del servicio y el status',
        status: 500,
        body: { code: 'OOPS' },
        code: 'OOPS',
        message: 'commerce devolvió HTTP 500',
        path: '/v1/orders/9',
      },
      {
        name: 'cuerpo sin code → INTERNAL_SERVER_ERROR',
        status: 502,
        body: { message: 'sin code' },
        code: 'INTERNAL_SERVER_ERROR',
        message: 'commerce devolvió HTTP 502',
        path: '/v1/orders/9',
      },
      {
        name: 'cuerpo no parseable → INTERNAL_SERVER_ERROR',
        status: 503,
        body: null,
        unparsable: true,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'commerce devolvió HTTP 503',
        path: '/v1/orders/9',
      },
    ]

    it.each(cases)('$name', async ({ status, body, unparsable, code, message, path }) => {
      fetchMock.mockResolvedValue(
        unparsable ? emptyBodyResponse(status) : jsonResponse(status, body),
      )

      const error = await callAndCatch(client.get('/v1/orders/9'))

      expect(error).toBeInstanceOf(GraphQLError)
      expect((error as GraphQLError).message).toBe(message)
      expect((error as GraphQLError).extensions).toEqual({ code, httpStatus: status, path })
    })
  })

  it('no marca como error una respuesta 2xx aunque venga con status 204-like', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await expect(client.get<{ ok: boolean }>('/v1/me')).resolves.toEqual({ ok: true })
  })

  it('propaga el error real si fetch rechaza (servicio caído)', async () => {
    const networkError = new Error('ECONNREFUSED')
    fetchMock.mockRejectedValue(networkError)

    await expect(client.get('/v1/me')).rejects.toBe(networkError)
  })
})

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

  it('propaga el internal token cuando el contexto lo trae', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { url: 'x' }))

    await client.postMultipart('/v1/catalog/uploads', new FormData(), {
      context: { internalToken: 'internal-1' },
    })

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['x-internal-token']).toBe('internal-1')
  })

  it('traduce un error de negocio del servicio en HttpException con su código y status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(415, {
        code: 'INVALID_IMAGE_TYPE',
        message: 'Formato de imagen no permitido',
        path: '/v1/catalog/uploads',
      }),
    )

    const error = await callAndCatch(client.postMultipart('/v1/catalog/uploads', new FormData()))

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(415)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INVALID_IMAGE_TYPE',
      message: 'Formato de imagen no permitido',
      path: '/v1/catalog/uploads',
    })
  })

  it('si el error no trae path usa el path del request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { code: 'IMAGE_REQUIRED', message: 'falta' }))

    const error = await callAndCatch(client.postMultipart('/v1/catalog/uploads', new FormData()))

    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'IMAGE_REQUIRED',
      path: '/v1/catalog/uploads',
    })
  })

  it.each([
    { name: 'cuerpo sin code', status: 422, body: { message: 'x' } },
    { name: 'cuerpo no parseable', status: 500, body: null, unparsable: true },
  ])('$name → HttpException INTERNAL_SERVER_ERROR', async ({ status, body, unparsable }) => {
    fetchMock.mockResolvedValue(
      unparsable ? emptyBodyResponse(status) : jsonResponse(status, body),
    )

    const error = await callAndCatch(client.postMultipart('/v1/catalog/uploads', new FormData()))

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      path: '/v1/catalog/uploads',
    })
  })
})
