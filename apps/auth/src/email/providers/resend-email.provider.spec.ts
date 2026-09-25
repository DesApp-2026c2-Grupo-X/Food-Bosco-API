import type { EmailMessage } from '../email.model'
import { ResendEmailProvider } from './resend-email.provider'

const message: EmailMessage = {
  to: 'cliente@example.com',
  subject: 'Asunto',
  html: '<p>Hola</p>',
  text: 'Hola',
}

const originalFetch = global.fetch

const mockFetch = (response: Partial<Response> & { ok: boolean; status?: number }): jest.Mock => {
  const fetchMock = jest.fn().mockResolvedValue(response)
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

afterEach(() => {
  global.fetch = originalFetch
})

describe('ResendEmailProvider', () => {
  it('envía el correo por la API de Resend con la API key en el header', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200 })
    const provider = new ResendEmailProvider('sk_test_123', 'Food Bosco <no-reply@x.com>')

    await provider.send(message)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.authorization).toBe('Bearer sk_test_123')
    expect(init.headers['content-type']).toBe('application/json')
  })

  it('envía from, destinatario, asunto, html y texto', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200 })
    const provider = new ResendEmailProvider('sk_test_123', 'Food Bosco <no-reply@x.com>')

    await provider.send(message)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual({
      from: 'Food Bosco <no-reply@x.com>',
      to: ['cliente@example.com'],
      subject: 'Asunto',
      html: '<p>Hola</p>',
      text: 'Hola',
    })
  })

  it('rechaza cuando Resend responde con error, sin filtrar la API key', async () => {
    mockFetch({ ok: false, status: 422 })
    const provider = new ResendEmailProvider('sk_secreta_123', 'Food Bosco <no-reply@x.com>')

    await expect(provider.send(message)).rejects.toThrow('Resend respondió HTTP 422')
    await expect(provider.send(message)).rejects.not.toThrow('sk_secreta_123')
  })
})
