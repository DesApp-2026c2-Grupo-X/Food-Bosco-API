import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SeedModule } from './seed.module'
import { SeedService } from './seed.service'

const run = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(SeedModule)
  try {
    await app.get(SeedService).seedSuperAdmin()
  } finally {
    await app.close()
  }
}

run()
  .then(() => Logger.log('Seed completado', 'Seed'))
  .catch((error: unknown) => {
    Logger.error(error instanceof Error ? error.message : String(error), undefined, 'Seed')
    process.exitCode = 1
  })
