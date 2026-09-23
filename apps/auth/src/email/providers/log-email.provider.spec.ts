import type { EmailMessage } from '../email.model'
import { LogEmailProvider } from './log-email.provider'

const message: EmailMessage = {
  to: 'cliente@example.com',
  subject: 'Asunto',
  html: '<a href="http://localhost:3000/reset-password?token=secreto">link</a>',
  text: 'http://localhost:3000/reset-password?token=secreto',
}

describe('LogEmailProvider', () => {
  it('no falla y resuelve sin enviar correo real', async () => {
    const provider = new LogEmailProvider()

    await expect(provider.send(message)).resolves.toBeUndefined()
  })

  it('no registra el token ni el enlace en los logs', async () => {
    const provider = new LogEmailProvider()
    const log = jest.spyOn(provider['logger'], 'log').mockImplementation(() => undefined)

    await provider.send(message)

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('cliente@example.com')
    expect(output).not.toContain('secreto')
    expect(output).not.toContain('token=')
  })
})
