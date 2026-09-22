import { Injectable, Logger } from '@nestjs/common'
import type { EmailMessage, EmailProvider } from '../email.model'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name)

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    })

    if (!response.ok) {
      this.logger.error(`Resend rechazó el envío (HTTP ${response.status})`)
      throw new Error(`Resend respondió HTTP ${response.status}`)
    }
  }
}
