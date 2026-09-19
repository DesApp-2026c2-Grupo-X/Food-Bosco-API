import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ERROR_CODES } from '../config/constants'
import { UploadExceptionFilter } from './upload-exception.filter'

type Host = {
  host: ArgumentsHost
  status: jest.Mock
  json: jest.Mock
}

const buildHost = (url = '/v1/uploads'): Host => {
  const status = jest.fn().mockReturnThis()
  const json = jest.fn()
  const response = { status, json } as unknown as Response
  const request = { url } as Request

  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost

  return { host, status, json }
}

describe('UploadExceptionFilter.catch', () => {
  const filter = new UploadExceptionFilter()

  it('respeta el code y message del HttpException y usa request.url como path', () => {
    const { host, status, json } = buildHost()
    const exception = new HttpException(
      { code: ERROR_CODES.imageRequired, message: 'Se requiere una imagen' },
      HttpStatus.BAD_REQUEST,
    )

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.imageRequired,
      message: 'Se requiere una imagen',
      path: '/v1/uploads',
    })
  })

  it('un code del payload tiene prioridad sobre el mapeo por status', () => {
    const { host, json } = buildHost()
    const exception = new HttpException({ code: 'CUSTOM_CODE', message: 'x' }, 400)

    filter.catch(exception, host)

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CUSTOM_CODE', path: '/v1/uploads' }),
    )
  })

  const statusCases: Array<{ status: number; expected: string; name: string }> = [
    { name: '401 → UNAUTHENTICATED', status: 401, expected: ERROR_CODES.unauthenticated },
    { name: '403 → FORBIDDEN', status: 403, expected: ERROR_CODES.forbidden },
    { name: '400 → BAD_REQUEST', status: 400, expected: ERROR_CODES.badRequest },
    { name: '413 → PAYLOAD_TOO_LARGE', status: 413, expected: ERROR_CODES.payloadTooLarge },
    { name: '500 → INTERNAL_SERVER_ERROR', status: 500, expected: ERROR_CODES.internal },
    { name: '422 → INTERNAL_SERVER_ERROR', status: 422, expected: ERROR_CODES.internal },
  ]

  it.each(statusCases)('HttpException string sin code: $name', ({ status, expected }) => {
    const { host, status: statusMock, json } = buildHost()
    const exception = new HttpException('mensaje', status)

    filter.catch(exception, host)

    expect(statusMock).toHaveBeenCalledWith(status)
    expect(json).toHaveBeenCalledWith({
      code: expected,
      message: 'mensaje',
      path: '/v1/uploads',
    })
  })

  it('une los mensajes cuando el HttpException trae un array', () => {
    const { host, json } = buildHost()
    const exception = new BadRequestException(['campo a inválido', 'campo b inválido'])

    filter.catch(exception, host)

    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.badRequest,
      message: 'campo a inválido; campo b inválido',
      path: '/v1/uploads',
    })
  })

  it('usa el message por defecto "Error" si el payload no trae message', () => {
    const { host, json } = buildHost()
    const exception = new HttpException({ code: 'X' }, 400)

    filter.catch(exception, host)

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'X', message: 'Error' }),
    )
  })

  it('excepción no-HttpException → 500 INTERNAL_SERVER_ERROR genérico', () => {
    const { host, status, json } = buildHost('/v1/uploads')

    filter.catch(new Error('boom secreto'), host)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.internal,
      message: 'Error interno del servidor',
      path: '/v1/uploads',
    })
  })
})
