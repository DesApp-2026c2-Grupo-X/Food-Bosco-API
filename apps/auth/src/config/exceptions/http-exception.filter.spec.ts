import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import type { Response } from 'express'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'
import { HttpExceptionFilter } from './http-exception.filter'

interface CapturedResponse {
  status: number
  body: { code: string; message: string; path: string }
}

const buildHost = (url: string) => {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const response = { status } as unknown as Response
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost

  const captured = (): CapturedResponse => ({
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as CapturedResponse['body'],
  })

  return { host, status, json, captured }
}

describe('HttpExceptionFilter — DomainException (RQ-REST-07, NFR-05)', () => {
  const filter = new HttpExceptionFilter()

  it('serializa un DomainException como envelope { code, message, path }', () => {
    const { host, captured } = buildHost('/v1/auth/login')

    filter.catch(
      new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401),
      host,
    )

    expect(captured()).toEqual({
      status: 401,
      body: {
        code: ERROR_CODES.invalidCredentials,
        message: 'Credenciales inválidas',
        path: '/v1/auth/login',
      },
    })
  })

  it.each([
    {
      name: 'conflicto de correo',
      error: new DomainException(ERROR_CODES.emailTaken, 'El correo ya está registrado', 409),
      status: 409,
      code: ERROR_CODES.emailTaken,
      message: 'El correo ya está registrado',
    },
    {
      name: 'token inválido',
      error: new DomainException(ERROR_CODES.invalidOrExpiredToken, 'Token inválido o expirado', 400),
      status: 400,
      code: ERROR_CODES.invalidOrExpiredToken,
      message: 'Token inválido o expirado',
    },
    {
      name: 'usuario inactivo',
      error: new DomainException(ERROR_CODES.userInactive, 'Usuario inactivo', 403),
      status: 403,
      code: ERROR_CODES.userInactive,
      message: 'Usuario inactivo',
    },
  ])('preserva el code y status del dominio: $name', ({ error, status, code, message }) => {
    const { host, captured } = buildHost('/v1/x')

    filter.catch(error, host)

    expect(captured().status).toBe(status)
    expect(captured().body).toEqual(expect.objectContaining({ code, message }))
  })

  it('usa el path de la request', () => {
    const { host, captured } = buildHost('/v1/auth/reset-password')

    filter.catch(new DomainException('X', 'msg', 400), host)

    expect(captured().body.path).toBe('/v1/auth/reset-password')
  })
})

describe('HttpExceptionFilter — HttpException (RQ-REST-07, NFR-05)', () => {
  const filter = new HttpExceptionFilter()

  it.each([
    {
      name: '400 Bad Request',
      error: new BadRequestException('dato inválido'),
      status: HttpStatus.BAD_REQUEST,
      code: ERROR_CODES.validationError,
    },
    {
      name: '401 Unauthorized',
      error: new UnauthorizedException(),
      status: HttpStatus.UNAUTHORIZED,
      code: ERROR_CODES.unauthenticated,
    },
    {
      name: '403 Forbidden',
      error: new ForbiddenException('Sin permisos'),
      status: HttpStatus.FORBIDDEN,
      code: ERROR_CODES.forbidden,
    },
    {
      name: '404 Not Found',
      error: new NotFoundException('No existe'),
      status: HttpStatus.NOT_FOUND,
      code: ERROR_CODES.notFound,
    },
    {
      name: '500 de Nest',
      error: new HttpException('falla', HttpStatus.INTERNAL_SERVER_ERROR),
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.internal,
    },
  ])('mapea $name al code correspondiente', ({ error, status, code }) => {
    const { host, captured } = buildHost('/v1/resource')

    filter.catch(error, host)

    expect(captured()).toEqual({ status, body: expect.objectContaining({ code }) })
  })

  it('usa el mensaje string del HttpException', () => {
    const { host, captured } = buildHost('/v1/x')

    filter.catch(new HttpException('mensaje directo', 400), host)

    expect(captured().body).toEqual({
      code: ERROR_CODES.validationError,
      message: 'mensaje directo',
      path: '/v1/x',
    })
  })

  it('une un arreglo de mensajes de validación con "; "', () => {
    const { host, captured } = buildHost('/v1/auth/register')

    filter.catch(new BadRequestException({ message: ['firstName vacío', 'email inválido'] }), host)

    expect(captured().body).toEqual({
      code: ERROR_CODES.validationError,
      message: 'firstName vacío; email inválido',
      path: '/v1/auth/register',
    })
  })

  it('usa body.message cuando es string', () => {
    const { host, captured } = buildHost('/v1/x')

    filter.catch(new HttpException({ message: 'objeto con mensaje' }, 400), host)

    expect(captured().body.message).toBe('objeto con mensaje')
  })

  it('cae a "Error" cuando el body no tiene mensaje', () => {
    const { host, captured } = buildHost('/v1/x')

    filter.catch(new HttpException({}, 400), host)

    expect(captured().body).toEqual({
      code: ERROR_CODES.validationError,
      message: 'Error',
      path: '/v1/x',
    })
  })

  it('KNOWN BUG: un HttpException 409 (Conflict) se etiqueta como INTERNAL_SERVER_ERROR', () => {
    const { host, captured } = buildHost('/v1/users')

    filter.catch(new ConflictException('conflicto de negocio'), host)

    expect(captured()).toEqual({
      status: 409,
      body: {
        code: ERROR_CODES.internal,
        message: 'conflicto de negocio',
        path: '/v1/users',
      },
    })
  })
})

describe('HttpExceptionFilter — error inesperado (NFR-05)', () => {
  const filter = new HttpExceptionFilter()

  it('mapea un error inesperado a 500 INTERNAL_SERVER_ERROR', () => {
    const { host, captured } = buildHost('/v1/me')

    filter.catch(new Error('boom'), host)

    expect(captured()).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ERROR_CODES.internal,
        message: 'Error interno del servidor',
        path: '/v1/me',
      },
    })
  })

  it.each([
    { name: 'string lanzado', thrown: 'boom' },
    { name: 'número lanzado', thrown: 42 },
    { name: 'null lanzado', thrown: null },
    { name: 'objeto sin mensaje', thrown: { detalle: 'x' } },
  ])('no filtra detalles internos ante $name', ({ thrown }) => {
    const { host, captured } = buildHost('/v1/me')

    filter.catch(thrown, host)

    expect(captured()).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: ERROR_CODES.internal,
        message: 'Error interno del servidor',
        path: '/v1/me',
      },
    })
  })
})
