import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common'
import { HEADERS } from '../constants'
import { env } from '../env'
import { CommerceClient, DEFAULT_COMMERCE_TIMEOUT_MS } from './commerce.client'

const jsonResponse = (status: number): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
  }) as Response

const abortOnce = (init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })

describe('CommerceClient.branchExists (RQ-AUTH-13)', () => {
  const client = new CommerceClient()
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('consulta GET /v1/branches/{branchId} con x-internal-token y devuelve true en 200', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200))

    await expect(client.branchExists('branch-1')).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      `${env.commerceServiceUrl}/v1/branches/branch-1`,
      expect.objectContaining({
        headers: expect.objectContaining({ [HEADERS.internalToken]: env.internalApiToken }),
      }),
    )
  })

  it('envía un AbortSignal ligado al timeout configurado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200))

    await client.branchExists('branch-1')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal?.aborted).toBe(false)
  })

  it('devuelve false cuando Commerce responde 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404))

    await expect(client.branchExists('no-existe')).resolves.toBe(false)
  })

  it.each([400, 401, 403, 500, 503])(
    'mapea una respuesta %i de Commerce a BadGatewayException 502',
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(status))

      const error = await client.branchExists('branch-1').catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(BadGatewayException)
      expect((error as BadGatewayException).getStatus()).toBe(502)
      expect((error as BadGatewayException).message).toBe(`Commerce devolvió HTTP ${status}`)
    },
  )

  it.each([
    { name: 'fallo de red', thrown: new TypeError('fetch failed') },
    { name: 'abort', thrown: new DOMException('The operation was aborted', 'AbortError') },
    { name: 'timeout', thrown: new DOMException('The operation timed out', 'TimeoutError') },
  ])('mapea $name al consultar Commerce a ServiceUnavailableException 503', async ({ thrown }) => {
    fetchMock.mockRejectedValue(thrown)

    const error = await client.branchExists('branch-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect((error as ServiceUnavailableException).getStatus()).toBe(503)
  })

  it('aborta la consulta al superar el timeout y la traduce a ServiceUnavailableException 503', async () => {
    const fastClient = new CommerceClient(20)

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => abortOnce(init))

    const error = await fastClient.branchExists('branch-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ServiceUnavailableException)
    expect((error as ServiceUnavailableException).getStatus()).toBe(503)
    expect((error as ServiceUnavailableException).message).toBe('Commerce no respondió en 20ms')
  })

  it('usa un default de timeout sensato cuando no se configura', () => {
    expect(DEFAULT_COMMERCE_TIMEOUT_MS).toBe(5_000)
  })

  it('codifica el branchId en la URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200))

    await client.branchExists('branch/1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${env.commerceServiceUrl}/v1/branches/branch%2F1`,
      expect.anything(),
    )
  })
})
