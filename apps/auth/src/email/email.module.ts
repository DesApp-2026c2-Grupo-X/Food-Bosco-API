import { Module } from '@nestjs/common'
import { env } from '../config/env'
import { EMAIL_PROVIDER, type EmailProvider } from './email.model'
import { EmailService } from './email.service'
import { LogEmailProvider } from './providers/log-email.provider'
import { ResendEmailProvider } from './providers/resend-email.provider'

const createEmailProvider = (): EmailProvider => {
  if (env.email.provider === 'resend') {
    if (!env.email.resendApiKey) {
      throw new Error('EMAIL_PROVIDER=resend requiere configurar RESEND_API_KEY')
    }

    return new ResendEmailProvider(env.email.resendApiKey, env.email.from)
  }

  return new LogEmailProvider()
}

@Module({
  providers: [{ provide: EMAIL_PROVIDER, useFactory: createEmailProvider }, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
