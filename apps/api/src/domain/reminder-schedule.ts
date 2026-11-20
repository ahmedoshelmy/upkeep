import { ensure } from './errors'
import { MS_PER_DAY } from './time'

export interface PlannedReminder {
  readonly fireAt: Date
  /** Days before the due moment; 0 is the "due now" reminder. */
  readonly leadDays: number
}

export const DEFAULT_LEAD_DAYS: readonly number[] = [30, 7, 1]
export const MAX_SNOOZE_DAYS = 30

/**
 * One reminder per lead time before the due moment, plus one at the due moment itself. Reminders whose moment
 * already passed are dropped, except that an overdue item still gets a single reminder right away.
 */
export function planReminders(dueAt: Date, leadDays: readonly number[], now: Date): PlannedReminder[] {
  ensure(
    leadDays.every((d) => Number.isFinite(d) && d > 0),
    'Lead times must be positive numbers of days',
  )
  const leads = [...new Set([...leadDays, 0])].sort((a, b) => b - a)
  const planned = leads
    .map((leadDays) => ({ leadDays, fireAt: new Date(dueAt.getTime() - leadDays * MS_PER_DAY) }))
    .filter((r) => r.fireAt > now)
  if (planned.length === 0) return [{ leadDays: 0, fireAt: now }]
  return planned
}

/** Snoozing moves one reminder later; it never moves earlier than now and never more than a month. */
export function snoozeUntil(now: Date, hours: number): Date {
  ensure(Number.isFinite(hours) && hours > 0, 'Snooze must be a positive number of hours')
  ensure(hours <= MAX_SNOOZE_DAYS * 24, `Snooze is limited to ${MAX_SNOOZE_DAYS} days`)
  return new Date(now.getTime() + hours * 3_600_000)
}

export function delayUntil(fireAt: Date, now: Date): number {
  return Math.max(0, fireAt.getTime() - now.getTime())
}
