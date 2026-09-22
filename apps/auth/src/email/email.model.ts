export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface PasswordRecoveryEmailInput {
  to: string
  firstName: string
  resetUrl: string
  expiresInMinutes: number
}

export interface PasswordRecoveryEmailData {
  to: string
  firstName: string
  token: string
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER'

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>
}
