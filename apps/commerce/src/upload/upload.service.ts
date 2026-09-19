import { Injectable } from '@nestjs/common'
import { ERROR_CODES } from '../config/constants'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import { isAllowedImageMimeType, type StoredImage, type UploadedImage } from './upload.model'
import { UploadRepository } from './upload.repository'

@Injectable()
export class UploadService {
  constructor(private readonly repository: UploadRepository) {}

  async storeImage(file: UploadedImage | undefined): Promise<StoredImage> {
    if (!file) {
      throw new DomainException(ERROR_CODES.imageRequired, 'Se requiere una imagen', 400)
    }

    if (!isAllowedImageMimeType(file.mimetype)) {
      throw new DomainException(
        ERROR_CODES.invalidImageType,
        'Formato de imagen no permitido (jpg, png, webp o gif)',
        415,
      )
    }

    if (file.size > env.uploads.maxSizeBytes) {
      throw new DomainException(
        ERROR_CODES.imageTooLarge,
        'La imagen supera el tamaño máximo permitido',
        413,
      )
    }

    try {
      return await this.repository.upload(file)
    } catch {
      throw new DomainException(ERROR_CODES.imageUploadFailed, 'No se pudo subir la imagen', 502)
    }
  }
}
