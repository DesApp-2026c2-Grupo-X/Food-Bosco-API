import { HttpException, HttpStatus } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { GraphQLError } from 'graphql'
import { formatGraphQLError } from './graphql-error-formatter'
import { ERROR_CODES } from '../config/constants'

describe('formatGraphQLError', () => {
  it('mapea un 403 a un mensaje claro en español sin filtrar el original', () => {
    const result = formatGraphQLError(
      { message: 'Forbidden', extensions: { code: ERROR_CODES.forbidden } },
      new HttpException('Forbidden', HttpStatus.FORBIDDEN),
    )

    expect(result.extensions?.code).toBe(ERROR_CODES.forbidden)
    expect(result.message).toBe('No tenés permisos para realizar esta acción.')
  })

  it('preserva el mensaje específico de un FORBIDDEN de dominio', () => {
    const result = formatGraphQLError(
      { message: 'Sin acceso a esta sucursal', extensions: { code: ERROR_CODES.forbidden } },
      new HttpException('Sin acceso a esta sucursal', HttpStatus.FORBIDDEN),
    )

    expect(result.message).toBe('Sin acceso a esta sucursal')
  })

  it('mapea un 401 sin código explícito a UNAUTHENTICATED con mensaje accionable', () => {
    const result = formatGraphQLError(
      { message: 'Unauthorized' },
      new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
    )

    expect(result.extensions?.code).toBe(ERROR_CODES.unauthenticated)
    expect(result.message).toBe('Tu sesión expiró o no es válida. Iniciá sesión nuevamente.')
  })

  it('sanitiza los errores internos para no exponer detalles técnicos', () => {
    const result = formatGraphQLError({ message: 'ECONNREFUSED 10.0.0.5' }, new Error('boom'))

    expect(result.extensions?.code).toBe(ERROR_CODES.internal)
    expect(result.message).toBe('Ocurrió un error inesperado. Intentá de nuevo en unos instantes.')
  })

  it('preserva el mensaje de los errores de dominio conocidos', () => {
    const result = formatGraphQLError(
      { message: 'Solo quedan 3 unidades disponibles.', extensions: { code: 'INSUFFICIENT_STOCK' } },
      new GraphQLError('Solo quedan 3 unidades disponibles.', {
        extensions: { code: 'INSUFFICIENT_STOCK' },
      }),
    )

    expect(result.extensions?.code).toBe('INSUFFICIENT_STOCK')
    expect(result.message).toBe('Solo quedan 3 unidades disponibles.')
  })

  it('toma el code del GraphQLError cuando formattedError no lo expone', () => {
    const result = formatGraphQLError(
      { message: 'boom' },
      new GraphQLError('boom', { extensions: { code: 'CUSTOM' } }),
    )

    expect(result.extensions?.code).toBe('CUSTOM')
  })

  it('mapea ThrottlerException a TOO_MANY_REQUESTS con mensaje en español (INT-13)', () => {
    const result = formatGraphQLError(
      {
        message: 'ThrottlerException: Too Many Requests',
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      },
      new ThrottlerException(),
    )

    expect(result.extensions?.code).toBe(ERROR_CODES.tooManyRequests)
    expect(result.message).toBe(
      'Demasiados intentos. Esperá un minuto antes de volver a intentarlo.',
    )
  })

  it('preserva el path del error', () => {
    const result = formatGraphQLError(
      { message: 'x', path: ['order', 0, 'branch'] },
      new GraphQLError('x', { extensions: { code: 'CUSTOM' } }),
    )

    expect(result.path).toEqual(['order', 0, 'branch'])
  })

  it('propaga details de campo sin romper el contrato público del error', () => {
    const details = {
      ingredientId: 'i1',
      requestedQuantity: 5,
      availableQuantity: 3,
    }
    const result = formatGraphQLError(
      {
        message: 'Sin stock',
        extensions: { code: 'INSUFFICIENT_STOCK', path: '/v1/orders', details, requestId: 'rid-1' },
      },
      new GraphQLError('Sin stock', {
        extensions: {
          code: 'INSUFFICIENT_STOCK',
          path: '/v1/orders',
          details,
          requestId: 'rid-1',
        },
      }),
    )

    expect(result.extensions).toEqual({
      code: 'INSUFFICIENT_STOCK',
      path: '/v1/orders',
      details,
    })
    expect(result.extensions).not.toHaveProperty('requestId')
  })

  it('no filtra stack ni propiedades internas del error', () => {
    const result = formatGraphQLError(
      { message: 'boom', extensions: { code: 'FORBIDDEN' } },
      new Error('boom'),
    )

    expect(Object.keys(result).sort()).toEqual(['extensions', 'message', 'path'])
    expect(result).not.toHaveProperty('stack')
  })
})
