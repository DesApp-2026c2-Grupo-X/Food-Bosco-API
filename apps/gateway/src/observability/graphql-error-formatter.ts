import { GraphQLError, GraphQLFormattedError } from 'graphql'
import { ERROR_CODES } from '../config/constants'

export const formatGraphQLError = (
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError => {
  const extensions = formattedError.extensions
  const code =
    typeof extensions?.code === 'string'
      ? extensions.code
      : error instanceof GraphQLError
        ? ((error.extensions?.code as string | undefined) ?? ERROR_CODES.internal)
        : ERROR_CODES.internal

  return {
    message: formattedError.message,
    path: formattedError.path,
    extensions: { code },
  }
}
