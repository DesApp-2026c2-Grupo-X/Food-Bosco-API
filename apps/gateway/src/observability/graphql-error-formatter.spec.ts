import { ThrottlerException } from '@nestjs/throttler'
import { GraphQLError, GraphQLFormattedError } from 'graphql'
import { formatGraphQLError } from './graphql-error-formatter'
import { ERROR_CODES } from '../config/constants'

type Case = {
  name: string
  formattedError: GraphQLFormattedError
  error: unknown
  expected: string
}

describe('formatGraphQLError', () => {
  const cases: Case[] = [
    {
      name: 'usa el código de extensions',
      formattedError: { message: 'boom', extensions: { code: 'FORBIDDEN' } },
      error: new Error('boom'),
      expected: 'FORBIDDEN',
    },
    {
      name: 'cae al código del GraphQLError',
      formattedError: { message: 'boom' },
      error: new GraphQLError('boom', { extensions: { code: 'UNAUTHENTICATED' } }),
      expected: 'UNAUTHENTICATED',
    },
    {
      name: 'sin código → INTERNAL_SERVER_ERROR',
      formattedError: { message: 'boom' },
      error: new Error('boom'),
      expected: ERROR_CODES.internal,
    },
  ]

  it.each(cases)('$name', ({ formattedError, error, expected }) => {
    const result = formatGraphQLError(formattedError, error)

    expect(result.extensions?.code).toBe(expected)
    expect(result.message).toBe('boom')
  })

  it('preserva el path del error', () => {
    const result = formatGraphQLError(
      { message: 'x', path: ['order', 0, 'branch'] },
      new Error('x'),
    )

    expect(result.path).toEqual(['order', 0, 'branch'])
  })

  it('no filtra stack ni propiedades internas del error', () => {
    const result = formatGraphQLError(
      { message: 'boom', extensions: { code: 'FORBIDDEN' } },
      new Error('boom'),
    )

    expect(Object.keys(result).sort()).toEqual(['extensions', 'message', 'path'])
    expect(result).not.toHaveProperty('stack')
  })

  it('preserva el path REST del downstream en extensions (RQ-GW-07)', () => {
    const result = formatGraphQLError(
      {
        message: 'boom',
        extensions: { code: 'ORDER_STATE_CONFLICT', path: '/v1/orders/o1' },
      },
      new GraphQLError('boom', {
        extensions: { code: 'ORDER_STATE_CONFLICT', path: '/v1/orders/o1' },
      }),
    )

    expect(result.extensions).toEqual({
      code: 'ORDER_STATE_CONFLICT',
      path: '/v1/orders/o1',
    })
  })

  it('toma el path REST del GraphQLError cuando formattedError no lo expone', () => {
    const result = formatGraphQLError(
      { message: 'boom' },
      new GraphQLError('boom', { extensions: { code: 'OOPS', path: '/v1/things/1' } }),
    )

    expect(result.extensions).toEqual({ code: 'OOPS', path: '/v1/things/1' })
  })

  it('no agrega path cuando el error no trae uno', () => {
    const result = formatGraphQLError(
      { message: 'boom', extensions: { code: 'FORBIDDEN' } },
      new Error('boom'),
    )

    expect(result.extensions).toEqual({ code: 'FORBIDDEN' })
  })

  it('ignora un code no-string en extensions y usa el del GraphQLError', () => {
    const result = formatGraphQLError(
      { message: 'boom', extensions: { code: 500 } },
      new GraphQLError('boom', { extensions: { code: 'CUSTOM' } }),
    )

    expect(result.extensions?.code).toBe('CUSTOM')
  })

  it('sin code válido en ninguno de los dos → INTERNAL_SERVER_ERROR', () => {
    const result = formatGraphQLError({ message: 'x', extensions: { code: 1 } }, new Error('x'))

    expect(result.extensions?.code).toBe(ERROR_CODES.internal)
  })

  it('mapea ThrottlerException a TOO_MANY_REQUESTS (INT-13)', () => {
    const result = formatGraphQLError(
      {
        message: 'ThrottlerException: Too Many Requests',
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      },
      new ThrottlerException(),
    )

    expect(result.extensions?.code).toBe(ERROR_CODES.tooManyRequests)
  })
})
