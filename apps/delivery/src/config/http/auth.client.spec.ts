import { HEADERS } from '../constants'
import { env } from '../env'
import { AuthClient, AuthUser } from './auth.client'

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

  it.each([500, 502, 401, 403])('lanza error con el status HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { message: 'boom' }))

    await expect(client.getUser('u1')).rejects.toThrow(`Auth devolvió HTTP ${status}`)
  })

  it('propaga el fallo de red (fetch rechaza)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(client.getUser('u1')).rejects.toThrow('ECONNREFUSED')
  })
})
