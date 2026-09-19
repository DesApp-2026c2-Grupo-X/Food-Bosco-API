import { ERROR_CODES } from '../config/constants'
import { env } from '../config/env'
import { DomainException } from '../config/exceptions/domain.exception'
import type { UploadedImage } from './upload.model'
import type { UploadRepository } from './upload.repository'
import { UploadService } from './upload.service'

const CLOUDINARY_URL =
  'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/burger.png'

const buildFile = (overrides: Partial<UploadedImage> = {}): UploadedImage => ({
  originalname: 'burger.png',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('image-bytes'),
  ...overrides,
})

const setup = (): { upload: jest.Mock; service: UploadService } => {
  const upload = jest.fn().mockResolvedValue({ url: CLOUDINARY_URL })
  const service = new UploadService({ upload } as unknown as UploadRepository)
  return { upload, service }
}

const expectDomainError = async (
  promise: Promise<unknown>,
  code: string,
  message: string,
): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(DomainException)
  await expect(promise).rejects.toMatchObject({ code, message })
}

describe('UploadService.storeImage', () => {
  const validCases: Array<{ name: string; mimetype: string }> = [
    { name: 'JPEG', mimetype: 'image/jpeg' },
    { name: 'PNG', mimetype: 'image/png' },
    { name: 'WebP', mimetype: 'image/webp' },
    { name: 'GIF', mimetype: 'image/gif' },
  ]

  it.each(validCases)(
    'acepta una imagen $name, la sube a Cloudinary y devuelve su URL',
    async ({ mimetype }) => {
      const { upload, service } = setup()
      const file = buildFile({ mimetype })

      const result = await service.storeImage(file)

      expect(result).toEqual({ url: CLOUDINARY_URL })
      expect(upload).toHaveBeenCalledTimes(1)
      expect(upload).toHaveBeenCalledWith(file)
    },
  )

  it('sin archivo → IMAGE_REQUIRED sin subir nada', async () => {
    const { upload, service } = setup()

    await expectDomainError(
      service.storeImage(undefined),
      ERROR_CODES.imageRequired,
      'Se requiere una imagen',
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('mime no permitido → INVALID_IMAGE_TYPE sin subir nada', async () => {
    const { upload, service } = setup()

    await expectDomainError(
      service.storeImage(buildFile({ mimetype: 'application/pdf' })),
      ERROR_CODES.invalidImageType,
      'Formato de imagen no permitido (jpg, png, webp o gif)',
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('tamaño exactamente en el límite → sube la imagen', async () => {
    const { upload, service } = setup()

    const result = await service.storeImage(buildFile({ size: env.uploads.maxSizeBytes }))

    expect(result).toEqual({ url: CLOUDINARY_URL })
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('tamaño por encima del límite → IMAGE_TOO_LARGE sin subir nada', async () => {
    const { upload, service } = setup()

    await expectDomainError(
      service.storeImage(buildFile({ size: env.uploads.maxSizeBytes + 1 })),
      ERROR_CODES.imageTooLarge,
      'La imagen supera el tamaño máximo permitido',
    )
    expect(upload).not.toHaveBeenCalled()
  })

  it('falla de Cloudinary → IMAGE_UPLOAD_FAILED (502)', async () => {
    const { upload, service } = setup()
    upload.mockRejectedValueOnce(new Error('cloudinary caído'))

    await expectDomainError(
      service.storeImage(buildFile()),
      ERROR_CODES.imageUploadFailed,
      'No se pudo subir la imagen',
    )
  })
})
