import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'
import { HttpExceptionFilter } from './http-exception.filter'

const makeHost = (url = '/v1/trips') => {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost
  return { host, status, json }
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter()

  it('mapea DomainException a su código, mensaje, status y path', () => {
    const { host, status, json } = makeHost()
    const exception = new DomainException(ERROR_CODES.offerExpired, 'La oferta venció', 409)

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.offerExpired,
      message: 'La oferta venció',
      path: '/v1/trips',
    })
  })

  it.each([
    {
      name: 'UnauthorizedException',
      exception: new UnauthorizedException(),
      status: 401,
      code: ERROR_CODES.unauthenticated,
    },
    {
      name: 'ForbiddenException',
      exception: new ForbiddenException(),
      status: 403,
      code: ERROR_CODES.forbidden,
    },
    {
      name: 'BadRequestException',
      exception: new BadRequestException('dato inválido'),
      status: 400,
      code: ERROR_CODES.validationError,
    },
    {
      name: 'NotFoundException',
      exception: new NotFoundException('no está'),
      status: 404,
      code: ERROR_CODES.notFound,
    },
  ])('mapea $name a $status/$code', ({ exception, status, code }) => {
    const { host, status: statusFn, json } = makeHost()

    filter.catch(exception, host)

    expect(statusFn).toHaveBeenCalledWith(status)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code }))
  })

  it('mantiene el mensaje de un BadRequestException string', () => {
    const { host, json } = makeHost()

    filter.catch(new BadRequestException('dato inválido'), host)

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'dato inválido' }))
  })

  it('une los mensajes de validación en un solo string', () => {
    const { host, json } = makeHost()

    filter.catch(
      new BadRequestException({ message: ['limit debe ser entero', 'offset inválido'] }),
      host,
    )

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'limit debe ser entero; offset inválido' }),
    )
  })

  it('usa un mensaje por defecto cuando el HttpException no trae message', () => {
    const { host, json } = makeHost()
    const exception = new HttpException({}, 418)

    filter.catch(exception, host)

    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.internal,
      message: 'Error',
      path: '/v1/trips',
    })
  })

  it('mapea HttpException no clasificadas a INTERNAL_SERVER_ERROR conservando el status', () => {
    const { host, status, json } = makeHost()

    filter.catch(new HttpException('teapot', 418), host)

    expect(status).toHaveBeenCalledWith(418)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERROR_CODES.internal, message: 'teapot' }),
    )
  })

  it('convierte errores desconocidos en 500 INTERNAL_SERVER_ERROR', () => {
    const { host, status, json } = makeHost()

    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.internal,
      message: 'Error interno del servidor',
      path: '/v1/trips',
    })
  })
})
