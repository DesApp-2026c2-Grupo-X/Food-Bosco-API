export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

export const isAllowedImageMimeType = (mimetype: string): mimetype is AllowedImageMimeType =>
  (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimetype)

export interface UploadedImage {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export interface StoredImage {
  url: string
}
