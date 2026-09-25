import { NestFactory } from '@nestjs/core'
import { runSeed } from '@repo/seed-utils'
import { SeedModule } from './seed.module'
import { SeedService } from './seed.service'

void runSeed({
  scope: 'Seed-Delivery',
  bootstrap: () => NestFactory.createApplicationContext(SeedModule),
  run: (app) => app.get(SeedService).seed(),
})
