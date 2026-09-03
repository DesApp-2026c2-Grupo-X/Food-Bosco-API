import { Module } from '@nestjs/common'
import { RestModule } from '../rest/rest.module'
import { SeedController } from './seed.controller'

@Module({
  imports: [RestModule],
  controllers: [SeedController],
})
export class SeedModule {}
