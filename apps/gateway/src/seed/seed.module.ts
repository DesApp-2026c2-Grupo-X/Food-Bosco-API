import { Module } from '@nestjs/common'
import { RestModule } from '../rest/rest.module'
import { SecurityModule } from '../security/security.module'
import { SeedController } from './seed.controller'

@Module({
  imports: [RestModule, SecurityModule],
  controllers: [SeedController],
})
export class SeedModule {}
