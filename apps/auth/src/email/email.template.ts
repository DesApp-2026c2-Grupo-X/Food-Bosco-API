import type { EmailMessage, PasswordRecoveryEmailInput } from './email.model'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const buildPasswordRecoveryEmail = ({
  to,
  firstName,
  resetUrl,
  expiresInMinutes,
}: PasswordRecoveryEmailInput): EmailMessage => {
  const name = firstName.trim()
  const greetingHtml = name ? `Hola ${escapeHtml(name)},` : 'Hola,'
  const greetingText = name ? `Hola ${name},` : 'Hola,'
  const subject = 'Recuperá tu contraseña — Food Bosco'
  const text = [
    greetingText,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Food Bosco.',
    `Ingresá al siguiente enlace para crear una nueva contraseña (válido por ${expiresInMinutes} minutos):`,
    '',
    resetUrl,
    '',
    'Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña actual seguirá siendo válida.',
    '',
    'Food Bosco',
  ].join('\n')

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:20px;">Recuperá tu contraseña</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${greetingHtml}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta de Food Bosco.
                  Hacé clic en el botón para crear una nueva contraseña.
                </p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;">
                    Restablecer contraseña
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52525b;">
                  Este enlace es válido por ${expiresInMinutes} minutos y puede usarse una sola vez.
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#52525b;">
                  Si no solicitaste este cambio, ignorá este correo. Tu contraseña actual seguirá siendo válida.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">
                  Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br />
                  <span style="word-break:break-all;">${escapeHtml(resetUrl)}</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { to, subject, html, text }
}
