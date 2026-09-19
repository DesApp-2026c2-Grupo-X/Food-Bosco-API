import { Module } from '@nestjs/common'
import { RestModule } from '../rest/rest.module'
import { SecurityModule } from '../security/security.module'
import { UploadController } from './upload.controller'

@Module({
  imports: [RestModule, SecurityModule],
  controllers: [UploadController],
})
export class UploadModule {}
