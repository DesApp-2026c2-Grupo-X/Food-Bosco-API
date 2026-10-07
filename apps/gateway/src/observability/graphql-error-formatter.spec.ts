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
})
