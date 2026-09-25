import { HEADERS, ORDER_STATUS } from '../constants'
import { env } from '../env'
import { CommerceClient } from './commerce.client'

const jsonResponse = (status: number): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue({}),
  }) as unknown as Response

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

  it.each([400, 404, 409, 500])('lanza error con el status HTTP %s', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(status))

    await expect(client.patchOrderStatus('ord-1', ORDER_STATUS.delivered)).rejects.toThrow(
      `Commerce devolvió HTTP ${status}`,
    )
  })

  it('propaga el fallo de red (fetch rechaza)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(client.patchOrderStatus('ord-1', ORDER_STATUS.delivered)).rejects.toThrow(
      'ECONNREFUSED',
    )
  })
})
