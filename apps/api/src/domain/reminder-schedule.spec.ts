import { DomainError } from './errors'
import { DEFAULT_LEAD_DAYS, delayUntil, planReminders, snoozeUntil } from './reminder-schedule'

const now = new Date('2026-03-01T08:00:00Z')

describe('reminder schedule', () => {
  it('plans 30, 7 and 1 days ahead plus the due moment', () => {
    const due = new Date('2026-06-01T08:00:00Z')
    const planned = planReminders(due, DEFAULT_LEAD_DAYS, now)
    expect(planned.map((p) => p.leadDays)).toEqual([30, 7, 1, 0])
    expect(planned[0].fireAt).toEqual(new Date('2026-05-02T08:00:00Z'))
    expect(planned[3].fireAt).toEqual(due)
  })

  it('drops lead times that already passed', () => {
    const due = new Date('2026-03-05T08:00:00Z')
    expect(planReminders(due, DEFAULT_LEAD_DAYS, now).map((p) => p.leadDays)).toEqual([1, 0])
  })

  it('gives an overdue item one immediate reminder', () => {
    const due = new Date('2026-02-01T00:00:00Z')
    expect(planReminders(due, DEFAULT_LEAD_DAYS, now)).toEqual([{ leadDays: 0, fireAt: now }])
  })

  it('a task due in one minute gets a single reminder one minute from now', () => {
    const due = new Date(now.getTime() + 60_000)
    const [only, ...rest] = planReminders(due, DEFAULT_LEAD_DAYS, now)
    expect(rest).toHaveLength(0)
    expect(delayUntil(only.fireAt, now)).toBe(60_000)
  })

  it('rejects bad lead times', () => {
    expect(() => planReminders(now, [0], now)).toThrow(DomainError)
    expect(() => planReminders(now, [Number.NaN], now)).toThrow(DomainError)
  })

  it('snoozes forward by hours, at most 30 days', () => {
    expect(snoozeUntil(now, 24)).toEqual(new Date('2026-03-02T08:00:00Z'))
    expect(() => snoozeUntil(now, 0)).toThrow(DomainError)
    expect(() => snoozeUntil(now, 31 * 24)).toThrow(DomainError)
  })

  it('never computes a negative delay', () => {
    expect(delayUntil(new Date(now.getTime() - 5000), now)).toBe(0)
  })
})
