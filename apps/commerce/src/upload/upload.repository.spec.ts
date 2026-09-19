import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env'
import type { UploadedImage } from './upload.model'
import { UploadRepository } from './upload.repository'

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload_stream: jest.fn() },
  },
}))

const configMock = cloudinary.config as unknown as jest.Mock
const uploadStreamMock = cloudinary.uploader.upload_stream as unknown as jest.Mock

type UploadStreamCallback = (
  error?: { message?: string } | undefined,
  result?: { secure_url: string; public_id?: string } | undefined,
) => void

const buildFile = (overrides: Partial<UploadedImage> = {}): UploadedImage => ({
  originalname: 'burger.png',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('image-bytes'),
  ...overrides,
})

describe('UploadRepository.upload', () => {
  beforeEach(() => jest.clearAllMocks())

  it('configura Cloudinary, sube el buffer y devuelve la secure_url', async () => {
    const contents = Buffer.from('image-bytes')
    const end = jest.fn()

    uploadStreamMock.mockImplementation((_options: unknown, callback: UploadStreamCallback) => ({
      end: (buffer: Buffer) => {
        end(buffer)
        callback(undefined, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/a.png',
          public_id: 'fastfood/products/a',
        })
      },
    }))

    const repository = new UploadRepository()
    const result = await repository.upload(buildFile({ buffer: contents }))

    expect(configMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: env.cloudinary.cloudName,
        api_key: env.cloudinary.apiKey,
        api_secret: env.cloudinary.apiSecret,
        secure: true,
      }),
    )
    expect(uploadStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ folder: env.cloudinary.folder, resource_type: 'image' }),
      expect.any(Function),
    )
    expect(end).toHaveBeenCalledWith(contents)
    expect(result).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/fastfood/products/a.png',
    })
  })

  it('si Cloudinary responde con error, rechaza con ese error', async () => {
    uploadStreamMock.mockImplementation((_options: unknown, callback: UploadStreamCallback) => ({
      end: () => callback({ message: 'invalid credentials' }, undefined),
    }))

    await expect(new UploadRepository().upload(buildFile())).rejects.toThrow('invalid credentials')
  })

  it('si Cloudinary no devuelve resultado, rechaza', async () => {
    uploadStreamMock.mockImplementation((_options: unknown, callback: UploadStreamCallback) => ({
      end: () => callback(undefined, undefined),
    }))

    await expect(new UploadRepository().upload(buildFile())).rejects.toThrow(
      /no devolvió resultado/i,
    )
  })
})
