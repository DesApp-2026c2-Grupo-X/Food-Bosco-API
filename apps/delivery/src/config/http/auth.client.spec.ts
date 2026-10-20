import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common'
import { HEADERS } from '../constants'
import { env } from '../env'
import { AuthClient, AuthUser } from './auth.client'

const callAndCatch = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error)

const authUser: AuthUser = {
  id: 'u1',
  firstName: 'Juan',
  lastName: 'Perez',
  phone: '11223344',
  vehicle: 'Moto',
  role: 'rider',
}

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response

describe('AuthClient.getUser', () => {
  let client: AuthClient
  let fetchMock: jest.Mock

  beforeEach(() => {
    client = new AuthClient()
    fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('construye la URL del usuario y envía el token interno', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, authUser))

    await client.getUser('u1')

    expect(fetchMock).toHaveBeenCalledWith(`${env.authServiceUrl}/v1/users/u1`, {
      headers: {
        accept: 'application/json',
        [HEADERS.internalToken]: env.internalApiToken,
      },
    })
  })

  it('mapea la respuesta JSON al usuario de Auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, authUser))

    await expect(client.getUser('u1')).resolves.toEqual(authUser)
  })

  it('devuelve null cuando Auth responde 404 (usuario inexistente)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'not found' }))

    await expect(client.getUser('u1')).resolves.toBeNull()
  })

  it.each([500, 502, 401, 403])(
    'sin código downstream, responde BAD_GATEWAY 502 (status %s)',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(status, { message: 'boom' }))

      const error = await callAndCatch(client.getUser('u1'))

      expect(error).toBeInstanceOf(BadGatewayException)
      expect((error as HttpException).getStatus()).toBe(502)
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'BAD_GATEWAY',
        path: '/v1/users/u1',
      })
    },
  )

  it('preserva el error de dominio de Auth', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { code: 'USER_CONFLICT', message: 'Usuario duplicado' }),
    )

    const error = await callAndCatch(client.getUser('u1'))

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(409)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'USER_CONFLICT',
      message: 'Usuario duplicado',
      path: '/v1/users/u1',
    })
  })

  it('traduce un fallo de red a SERVICE_UNAVAILABLE 503', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    const error = await callAndCatch(client.getUser('u1'))

    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect((error as HttpException).getStatus()).toBe(503)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      path: '/v1/users/u1',
    })
  })
})
