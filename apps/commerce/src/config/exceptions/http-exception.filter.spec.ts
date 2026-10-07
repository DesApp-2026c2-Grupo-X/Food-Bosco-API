import { HttpException, HttpStatus } from '@nestjs/common'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'
import { HttpExceptionFilter } from './http-exception.filter'

const makeHost = () => {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const response = { status }
  const request = { url: '/v1/test' }
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  }
  return { host, status, json }
}

describe('HttpExceptionFilter (RQ-REST-07)', () => {
  const filter = new HttpExceptionFilter()

  it('serializa DomainException con su code, status y path', () => {
    const { host, status, json } = makeHost()

    filter.catch(
      new DomainException(ERROR_CODES.orderNotFound, 'Pedido no encontrado', 404),
      host as never,
    )

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.orderNotFound,
      message: 'Pedido no encontrado',
      path: '/v1/test',
    })
  })

  it.each([
    { status: HttpStatus.UNAUTHORIZED, code: ERROR_CODES.unauthenticated },
    { status: HttpStatus.FORBIDDEN, code: ERROR_CODES.forbidden },
    { status: HttpStatus.BAD_REQUEST, code: ERROR_CODES.validationError },
    { status: HttpStatus.NOT_FOUND, code: ERROR_CODES.notFound },
    { status: HttpStatus.PAYLOAD_TOO_LARGE, code: ERROR_CODES.payloadTooLarge },
    { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, code: ERROR_CODES.invalidImageType },
    { status: HttpStatus.CONFLICT, code: ERROR_CODES.internal },
  ])('mapea HttpException $status → $code', ({ status, code }) => {
    const { host, status: statusSpy, json } = makeHost()

    filter.catch(new HttpException('boom', status), host as never)

    expect(statusSpy).toHaveBeenCalledWith(status)
    expect(json).toHaveBeenCalledWith({ code, message: 'boom', path: '/v1/test' })
  })

  it('une los mensajes de validación en arreglo', () => {
    const { host, json } = makeHost()

    filter.catch(
      new HttpException({ message: ['campo a', 'campo b'] }, HttpStatus.BAD_REQUEST),
      host as never,
    )

    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.validationError,
      message: 'campo a; campo b',
      path: '/v1/test',
    })
  })

  it('mapea errores desconocidos a 500 INTERNAL_SERVER_ERROR', () => {
    const { host, status, json } = makeHost()

    filter.catch(new Error('inesperado'), host as never)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.internal,
      message: 'Error interno del servidor',
      path: '/v1/test',
    })
  })
})
