import { ArgumentsHost, BadRequestException, ForbiddenException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'
import { ERROR_CODES } from '../constants'
import { DomainException } from './domain.exception'
import { HttpExceptionFilter } from './http-exception.filter'

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

  return { host, status, json }
}

describe('HttpExceptionFilter (RQ-REST-07, NFR-05)', () => {
  const filter = new HttpExceptionFilter()

  it('serializa un DomainException como envelope { code, message, path }', () => {
    const { host, status, json } = buildHost('/v1/auth/login')
    filter.catch(new DomainException(ERROR_CODES.invalidCredentials, 'Credenciales inválidas', 401), host)

    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith({
      code: ERROR_CODES.invalidCredentials,
      message: 'Credenciales inválidas',
      path: '/v1/auth/login',
    })
  })

  it('mapea una excepción 403 a FORBIDDEN', () => {
    const { host, status, json } = buildHost('/v1/users')
    filter.catch(new ForbiddenException('Sin permisos'), host)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.forbidden }))
  })

  it('mapea errores de validación 400 a VALIDATION_ERROR', () => {
    const { host, status, json } = buildHost('/v1/auth/register')
    filter.catch(new BadRequestException({ message: ['firstName no debe estar vacío'] }), host)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERROR_CODES.validationError, message: 'firstName no debe estar vacío' }),
    )
  })

  it('mapea un error inesperado a 500 INTERNAL_SERVER_ERROR', () => {
    const { host, status, json } = buildHost('/v1/me')
    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERROR_CODES.internal, message: 'Error interno del servidor' }),
    )
  })
})
