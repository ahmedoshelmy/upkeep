/** A broken business rule. The presentation layer maps it to a GraphQL error with code BAD_USER_INPUT. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new DomainError(message)
}
