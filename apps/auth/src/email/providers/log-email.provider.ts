import { Injectable, Logger } from '@nestjs/common'
import type { EmailMessage, EmailProvider } from '../email.model'

@Injectable()
export class LogEmailProvider implements EmailProvider {
  private readonly logger = new Logger(LogEmailProvider.name)

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`Email simulado para ${message.to} — asunto: "${message.subject}"`)
  }
}
