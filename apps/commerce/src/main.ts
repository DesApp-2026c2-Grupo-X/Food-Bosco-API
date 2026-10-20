import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { env } from './config/env'
import { HttpExceptionFilter } from './config/exceptions/http-exception.filter'
import { createValidationPipe } from './config/validation/validation.pipe'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  app.useGlobalPipes(createValidationPipe())
  app.useGlobalFilters(new HttpExceptionFilter())

  await app.listen(env.port)
  Logger.log(`Commerce API corriendo en http://localhost:${env.port}`, 'Bootstrap')
}

void bootstrap()
