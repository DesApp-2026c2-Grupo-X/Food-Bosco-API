import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env'
import type { StoredImage, UploadedImage } from './upload.model'

@Injectable()
export class UploadRepository {
  private readonly logger = new Logger(UploadRepository.name)

  constructor() {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    })
  }

  upload(file: UploadedImage): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: env.cloudinary.folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary rechazó la subida: ${error?.message ?? 'sin resultado'}`)
            reject(new Error(error?.message ?? 'Cloudinary no devolvió resultado'))
            return
          }

          resolve({ url: result.secure_url })
        },
      )

      stream.end(file.buffer)
    })
  }
}
