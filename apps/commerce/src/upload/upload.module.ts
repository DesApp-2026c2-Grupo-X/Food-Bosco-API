import { Module } from '@nestjs/common'
import { UploadController } from './upload.controller'
import { UploadRepository } from './upload.repository'
import { UploadService } from './upload.service'

@Module({
  controllers: [UploadController],
  providers: [UploadRepository, UploadService],
})
export class UploadModule {}
