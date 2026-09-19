import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ROLES } from '../config/constants'
import { env } from '../config/env'
import { Roles } from '../config/security/roles.decorator'
import type { StoredImage, UploadedImage } from './upload.model'
import { UploadService } from './upload.service'

@Controller('v1/catalog/uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles(ROLES.superAdmin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: env.uploads.maxSizeBytes, files: 1 },
    }),
  )
  uploadImage(@UploadedFile() file: UploadedImage | undefined): Promise<StoredImage> {
    return this.uploadService.storeImage(file)
  }
}
