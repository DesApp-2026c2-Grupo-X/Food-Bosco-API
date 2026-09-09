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
})
