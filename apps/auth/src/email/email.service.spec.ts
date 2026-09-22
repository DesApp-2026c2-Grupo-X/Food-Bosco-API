import { ERROR_CODES, ROLES } from '../config/constants'
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
  it('construye la URL del store a partir de la configuración del backend', () => {
    const { service } = makeService()

    const url = service.buildPasswordResetUrl('token-crudo', ROLES.customer)

    expect(url).toBe(`${env.email.frontendUrls.customer}/reset-password?token=token-crudo`)
  })

  it.each([
    { role: ROLES.customer, base: env.email.frontendUrls.customer },
    { role: ROLES.superAdmin, base: env.email.frontendUrls.super_admin },
    { role: ROLES.branchAdmin, base: env.email.frontendUrls.branch_admin },
    { role: ROLES.rider, base: env.email.frontendUrls.rider },
  ])('resuelve la base del frontend según el rol $role', ({ role, base }) => {
    const { service } = makeService()

    const url = service.buildPasswordResetUrl('t', role)

    expect(url).toBe(`${base}/reset-password?token=t`)
  })

  it('codifica el token para que no rompa la query string', () => {
    const { service } = makeService()

    const url = service.buildPasswordResetUrl('a b/c+d?e', ROLES.customer)

    expect(url).toBe(
      `${env.email.frontendUrls.customer}/reset-password?token=${encodeURIComponent('a b/c+d?e')}`,
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
      role: ROLES.customer,
    })

    expect(send).toHaveBeenCalledTimes(1)
    const message = send.mock.calls[0][0]
    expect(message.to).toBe('cliente@example.com')
    expect(message.subject).toContain('contraseña')
    expect(message.html).toContain(
      `${env.email.frontendUrls.customer}/reset-password?token=token-crudo`,
    )
    expect(message.text).toContain(
      `${env.email.frontendUrls.customer}/reset-password?token=token-crudo`,
    )
  })

  it('envía el enlace al frontend que corresponde al rol', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({
      to: 'admin@example.com',
      firstName: 'Ada',
      token: 'token-admin',
      role: ROLES.superAdmin,
    })

    const message = send.mock.calls[0][0]
    expect(message.text).toContain(
      `${env.email.frontendUrls.super_admin}/reset-password?token=token-admin`,
    )
  })

  it('incluye el nombre del usuario en el cuerpo del correo', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({
      to: 'a@b.com',
      firstName: 'Ana',
      token: 't',
      role: ROLES.customer,
    })

    const message = send.mock.calls[0][0]
    expect(message.html).toContain('Ana')
    expect(message.text).toContain('Ana')
  })

  it('no expone el token crudo en el asunto', async () => {
    const { send, service } = makeService()

    await service.sendPasswordRecovery({
      to: 'a@b.com',
      firstName: 'Ana',
      token: 'token-secreto',
      role: ROLES.customer,
    })

    const message = send.mock.calls[0][0]
    expect(message.subject).not.toContain('token-secreto')
  })

  it('falla del proveedor → EMAIL_SEND_FAILED 502 sin filtrar detalles', async () => {
    const send = jest.fn().mockRejectedValue(new Error('resend caído: key sk_live_123'))
    const service = new EmailService({ send } as unknown as EmailProvider)

    await expect(
      service.sendPasswordRecovery({
        to: 'a@b.com',
        firstName: 'Ana',
        token: 't',
        role: ROLES.customer,
      }),
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
      service.sendPasswordRecovery({
        to: 'a@b.com',
        firstName: 'Ana',
        token: 't',
        role: ROLES.customer,
      }),
    ).rejects.toBeInstanceOf(DomainException)
  })
})
