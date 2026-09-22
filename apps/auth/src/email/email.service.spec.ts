import { ERROR_CODES } from '../config/constants'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { EmailService } from './email.service'
import type { EmailProvider } from './email.model'

const makeService = () => {
  const send = jest.fn().mockResolvedValue(undefined)
  const service = new EmailService({ send } as unknown as EmailProvider)
  return { send, service }
}

describe('EmailService.buildPasswordResetUrl', () => {
  it('construye la URL a partir de la configuración del backend', () => {
    const { service } = makeService()

    const url = service.buildPasswordResetUrl('token-crudo')

    expect(url).toBe(`${env.email.frontendUrl}/reset-password?token=token-crudo`)
  })

  it('codifica el token para que no rompa la query string', () => {
    const { service } = makeService()

    const url = service.buildPasswordResetUrl('a b/c+d?e')

    expect(url).toBe(
      `${env.email.frontendUrl}/reset-password?token=${encodeURIComponent('a b/c+d?e')}`,
    )
  })
})

describe('EmailService.sendPasswordRecovery', () => {
  it('envía el correo al destinatario con asunto y enlace de recuperación', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({
      to: 'cliente@example.com',
      firstName: 'Juan',
      token: 'token-crudo',
    })

    expect(send).toHaveBeenCalledTimes(1)
    const message = send.mock.calls[0][0]
    expect(message.to).toBe('cliente@example.com')
    expect(message.subject).toContain('contraseña')
    expect(message.html).toContain(`${env.email.frontendUrl}/reset-password?token=token-crudo`)
    expect(message.text).toContain(`${env.email.frontendUrl}/reset-password?token=token-crudo`)
  })

  it('incluye el nombre del usuario en el cuerpo del correo', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({ to: 'a@b.com', firstName: 'Ana', token: 't' })

    const message = send.mock.calls[0][0]
    expect(message.html).toContain('Ana')
    expect(message.text).toContain('Ana')
  })

  it('no expone el token crudo en el asunto', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({ to: 'a@b.com', firstName: 'Ana', token: 'token-secreto' })

    const message = send.mock.calls[0][0]
    expect(message.subject).not.toContain('token-secreto')
  })

  it('falla del proveedor → EMAIL_SEND_FAILED 502 sin filtrar detalles', async () => {
    const send = jest.fn().mockRejectedValue(new Error('resend caído: key sk_live_123'))
    const service = new EmailService({ send } as unknown as EmailProvider)

    await expect(
      service.sendPasswordRecovery({ to: 'a@b.com', firstName: 'Ana', token: 't' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.emailSendFailed,
      message: 'No se pudo enviar el correo de recuperación',
      status: 502,
    })
  })

  it('propaga DomainException del proveedor sin envolverlo dos veces', async () => {
    const send = jest.fn().mockRejectedValue(new Error('boom'))
    const service = new EmailService({ send } as unknown as EmailProvider)

    await expect(
      service.sendPasswordRecovery({ to: 'a@b.com', firstName: 'Ana', token: 't' }),
    ).rejects.toBeInstanceOf(DomainException)
  })
})
