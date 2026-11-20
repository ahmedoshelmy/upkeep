export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} ${id} was not found`)
    this.name = 'NotFoundError'
  }
}

/** The job outran the transaction that created its reminder (or the row is gone): let the queue retry it. */
export class ReminderNotVisibleError extends Error {
  constructor(id: string) {
    super(`Reminder ${id} is not visible yet`)
    this.name = 'ReminderNotVisibleError'
  }
}
