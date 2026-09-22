import { Inject, Injectable, Logger } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { EMAIL_PROVIDER, type EmailProvider, type PasswordRecoveryEmailData } from './email.model'
import { buildPasswordRecoveryEmail } from './email.template'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  async sendPasswordRecovery({ to, firstName, token }: PasswordRecoveryEmailData): Promise<void> {
    const message = buildPasswordRecoveryEmail({
      to,
      firstName,
      resetUrl: this.buildPasswordResetUrl(token),
      expiresInMinutes: Math.max(1, Math.round(env.passwordRecoveryTtlMs / 60_000)),
    })

    try {
      await this.provider.send(message)
    } catch {
      this.logger.error(`No se pudo enviar el correo de recuperación a ${to}`)
      throw new DomainException(
        ERROR_CODES.emailSendFailed,
        'No se pudo enviar el correo de recuperación',
        502,
      )
    }
  }

  buildPasswordResetUrl(token: string): string {
    const base = env.email.frontendUrl.replace(/\/+$/, '')
    const path = env.email.passwordResetPath.startsWith('/')
      ? env.email.passwordResetPath
      : `/${env.email.passwordResetPath}`

    return `${base}${path}?token=${encodeURIComponent(token)}`
  }
}
