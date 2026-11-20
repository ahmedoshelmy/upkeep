import type { GraphQLFormattedError } from 'graphql'
import { unwrapResolverError } from '@apollo/server/errors'
import { DomainError } from '../../domain/errors'
import { NotFoundError } from '../../application/errors'

/** Business-rule and not-found errors become typed GraphQL errors; anything else is hidden behind a generic one. */
export function formatError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = unwrapResolverError(error)
  if (original instanceof DomainError) {
    return { message: original.message, path: formatted.path, extensions: { code: 'BAD_USER_INPUT' } }
  }
  if (original instanceof NotFoundError) {
    return { message: original.message, path: formatted.path, extensions: { code: 'NOT_FOUND' } }
  }
  const code = formatted.extensions?.code
  if (code && code !== 'INTERNAL_SERVER_ERROR') return formatted
  return {
    message: 'Internal server error',
    path: formatted.path,
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  }
}
