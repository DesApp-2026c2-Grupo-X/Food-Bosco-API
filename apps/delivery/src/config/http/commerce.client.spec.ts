import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common'
import { HEADERS, ORDER_STATUS } from '../constants'
import { env } from '../env'
import { CommerceClient } from './commerce.client'

const jsonResponse = (status: number, body: unknown = {}): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response

const callAndCatch = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error)

describe('CommerceClient.patchOrderStatus', () => {
  let client: CommerceClient
  let fetchMock: jest.Mock

  beforeEach(() => {
    client = new CommerceClient()
    fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('hace PATCH a /v1/orders/:id/status con el body y headers correctos', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200))

    await client.patchOrderStatus('ord-1', ORDER_STATUS.onTheWay)

    expect(fetchMock).toHaveBeenCalledWith(`${env.commerceServiceUrl}/v1/orders/ord-1/status`, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        [HEADERS.internalToken]: env.internalApiToken,
      },
      body: JSON.stringify({ status: ORDER_STATUS.onTheWay }),
    })
  })

  it.each([
    { name: 'on_the_way', status: ORDER_STATUS.onTheWay },
    { name: 'delivered', status: ORDER_STATUS.delivered },
  ])('serializa el status $name en el body', async ({ status }) => {
    fetchMock.mockResolvedValue(jsonResponse(204))

    await expect(client.patchOrderStatus('ord-1', status)).resolves.toBeUndefined()

    const call = fetchMock.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(call[1].body)).toEqual({ status })
  })

  it.each([400, 404, 409, 500])(
    'sin código downstream, responde BAD_GATEWAY 502 en vez de 500 genérico (status %s)',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(status))

      const error = await callAndCatch(client.patchOrderStatus('ord-1', ORDER_STATUS.delivered))

      expect(error).toBeInstanceOf(BadGatewayException)
      expect((error as HttpException).getStatus()).toBe(502)
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'BAD_GATEWAY',
        message: 'Commerce no pudo procesar la solicitud.',
        path: '/v1/orders/ord-1/status',
      })
    },
  )

  it('preserva el error de dominio de Commerce (code, mensaje, status y details)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        code: 'INVALID_TRANSITION',
        message: 'Transición inválida: pending → delivered',
        details: { from: 'pending', to: 'delivered' },
      }),
    )

    const error = await callAndCatch(client.patchOrderStatus('ord-1', ORDER_STATUS.delivered))

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(409)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'INVALID_TRANSITION',
      message: 'Transición inválida: pending → delivered',
      details: { from: 'pending', to: 'delivered' },
      path: '/v1/orders/ord-1/status',
    })
  })

  it('traduce un fallo de red a SERVICE_UNAVAILABLE 503 sin filtrar el error técnico', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5'))

    const error = await callAndCatch(client.patchOrderStatus('ord-1', ORDER_STATUS.delivered))

    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect((error as HttpException).getStatus()).toBe(503)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'No pudimos comunicarnos con Commerce. Intentá de nuevo en unos instantes.',
      path: '/v1/orders/ord-1/status',
    })
  })
})
