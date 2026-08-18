import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const port = process.env.PORT ?? 4201
  await app.listen(port)
  Logger.log(`Auth API corriendo en http://localhost:${port}`, 'Bootstrap')
}
void bootstrap()
