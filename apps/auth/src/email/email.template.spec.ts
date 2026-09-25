import { buildPasswordRecoveryEmail } from './email.template'

describe('buildPasswordRecoveryEmail', () => {
  const input = {
    to: 'cliente@example.com',
    firstName: 'Juan',
    resetUrl: 'https://app.foodbosco.com/reset-password?token=abc',
    expiresInMinutes: 60,
  }

  it('devuelve destinatario, asunto, html y texto', () => {
    const message = buildPasswordRecoveryEmail(input)

    expect(message.to).toBe('cliente@example.com')
    expect(message.subject).toBeTruthy()
    expect(message.html).toContain('<html')
    expect(message.text).toContain(input.resetUrl)
  })

  it('incluye el enlace de restablecimiento y la vigencia en ambos formatos', () => {
    const message = buildPasswordRecoveryEmail(input)

    expect(message.html).toContain(input.resetUrl)
    expect(message.text).toContain(input.resetUrl)
    expect(message.html).toContain('60')
    expect(message.text).toContain('60')
  })

  it('escapa HTML del nombre para evitar inyección', () => {
    const message = buildPasswordRecoveryEmail({
      ...input,
      firstName: '<img src=x onerror=alert(1)>',
    })

    expect(message.html).not.toContain('<img src=x onerror=alert(1)>')
    expect(message.html).toContain('&lt;img')
  })

  it('usa un saludo neutro si el nombre viene vacío', () => {
    const message = buildPasswordRecoveryEmail({ ...input, firstName: '   ' })

    expect(message.html).toContain('Hola,')
    expect(message.text).toContain('Hola,')
  })
})
