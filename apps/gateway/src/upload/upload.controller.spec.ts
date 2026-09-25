import { HttpException } from '@nestjs/common'
import type { Request } from 'express'
import type { RestClient } from '../rest/rest.client'
import type { JwtService } from '../security/jwt.service'
import { UploadController } from './upload.controller'
import type { UploadedImage } from './upload.types'

const AUTH = 'Bearer admin-token'

const buildRequest = (headers: Record<string, string> = {}): Request =>
  ({ headers: { authorization: AUTH, ...headers } }) as unknown as Request

const buildFile = (overrides: Partial<UploadedImage> = {}): UploadedImage => ({
  originalname: 'burger.png',
  mimetype: 'image/png',
  size: 3,
  buffer: Buffer.from('abc'),
  ...overrides,
})

const setup = (): { postMultipart: jest.Mock; verify: jest.Mock; controller: UploadController } => {
  const postMultipart = jest.fn().mockResolvedValue({ url: 'http://localhost:4202/uploads/x.png' })
  const verify = jest.fn().mockReturnValue({
    authenticated: true,
    userId: 'admin-1',
    roles: ['super_admin'],
    branchId: null,
  })
  const controller = new UploadController(
    { postMultipart } as unknown as RestClient,
    { verify } as unknown as JwtService,
  )
  return { postMultipart, verify, controller }
}

describe('UploadController.uploadImage', () => {
  it('reenvía el archivo a Commerce como multipart, propagando el contexto de auth', async () => {
    const { postMultipart, controller } = setup()

    const result = await controller.uploadImage(
      buildRequest({ 'x-request-id': 'rid-1' }),
      buildFile(),
    )

    expect(result).toEqual({ url: 'http://localhost:4202/uploads/x.png' })
    expect(postMultipart).toHaveBeenCalledTimes(1)

    const [path, form, options] = postMultipart.mock.calls[0] as [
      string,
      FormData,
      { context: Record<string, unknown> },
    ]
    expect(path).toBe('/v1/catalog/uploads')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('file')).toBeInstanceOf(Blob)
    expect(options.context).toMatchObject({
      authorization: AUTH,
      userId: 'admin-1',
      roles: ['super_admin'],
      requestId: 'rid-1',
    })
  })

  it('sin archivo → 400 IMAGE_REQUIRED y no llama a Commerce', async () => {
    const { postMultipart, controller } = setup()

    const error = await controller.uploadImage(buildRequest(), undefined).catch((thrown) => thrown)

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(400)
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'IMAGE_REQUIRED',
      message: 'Se requiere una imagen',
    })
    expect(postMultipart).not.toHaveBeenCalled()
  })

  it('propaga tal cual el error devuelto por Commerce', async () => {
    const { postMultipart, controller } = setup()
    const commerceError = new HttpException(
      { code: 'PAYLOAD_TOO_LARGE', message: 'File too large' },
      413,
    )
    postMultipart.mockRejectedValueOnce(commerceError)

    const error = await controller
      .uploadImage(buildRequest(), buildFile())
      .catch((thrown) => thrown)

    expect(error).toBe(commerceError)
  })
})

describe('UploadController.uploadImage — contexto y errores de Commerce', () => {
  it('propaga el contexto exacto con requestId null cuando falta', async () => {
    const { postMultipart, verify, controller } = setup()

    await controller.uploadImage(buildRequest(), buildFile())

    expect(verify).toHaveBeenCalledWith(AUTH)
    const [, , options] = postMultipart.mock.calls[0] as [
      string,
      FormData,
      { context: Record<string, unknown> },
    ]
    expect(options.context).toEqual({
      authorization: AUTH,
      userId: 'admin-1',
      roles: ['super_admin'],
      branchId: null,
      requestId: null,
    })
  })

  it('toma el primer valor cuando los headers llegan como array', async () => {
    const { postMultipart, controller } = setup()
    const request = {
      headers: { authorization: [AUTH], 'x-request-id': ['rid-a', 'rid-b'] },
    } as unknown as Request

    await controller.uploadImage(request, buildFile())

    const [, , options] = postMultipart.mock.calls[0] as [
      string,
      FormData,
      { context: Record<string, unknown> },
    ]
    expect(options.context).toMatchObject({ authorization: AUTH, requestId: 'rid-a' })
  })

  it('construye el Blob con el mimetype y nombre del archivo subido', async () => {
    const { postMultipart, controller } = setup()
    const file = buildFile({
      originalname: 'pizza.webp',
      mimetype: 'image/webp',
      buffer: Buffer.from('xyz'),
    })

    await controller.uploadImage(buildRequest(), file)

    const form = postMultipart.mock.calls[0][1] as FormData
    const blob = form.get('file') as Blob & { name?: string }
    expect(blob.type).toBe('image/webp')
    expect(blob.size).toBe(3)
    expect(blob.name).toBe('pizza.webp')
  })

  it.each([
    { code: 'IMAGE_REQUIRED', status: 400, message: 'Se requiere una imagen' },
    { code: 'INVALID_IMAGE_TYPE', status: 415, message: 'Formato de imagen no permitido' },
    { code: 'PAYLOAD_TOO_LARGE', status: 413, message: 'Archivo demasiado grande' },
  ])('propaga sin alterar el error $code de Commerce', async ({ code, status, message }) => {
    const { postMultipart, controller } = setup()
    const commerceError = new HttpException({ code, message }, status)
    postMultipart.mockRejectedValueOnce(commerceError)

    const error = await controller
      .uploadImage(buildRequest(), buildFile())
      .catch((thrown) => thrown)

    expect(error).toBe(commerceError)
    expect((error as HttpException).getStatus()).toBe(status)
    expect((error as HttpException).getResponse()).toMatchObject({ code, message })
  })
})
