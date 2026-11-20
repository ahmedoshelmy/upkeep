import { describe, expect, it } from 'vitest'
import { daysUntil, describeDue, urgencyOf } from './due'

const now = new Date('2026-03-01T12:00:00Z')
const plus = (ms: number) => new Date(now.getTime() + ms)
const DAY = 86_400_000

describe('due helpers', () => {
  it('classifies urgency', () => {
    expect(urgencyOf(plus(-1), now)).toBe('overdue')
    expect(urgencyOf(plus(3 * DAY), now)).toBe('soon')
    expect(urgencyOf(plus(20 * DAY), now)).toBe('later')
  })

  it('describes the distance to the due moment', () => {
    expect(describeDue(plus(-3 * DAY), now)).toBe('overdue by 3 days')
    expect(describeDue(plus(-1000), now)).toBe('due today')
    expect(describeDue(plus(90_000), now)).toBe('in 2 min')
    expect(describeDue(plus(5 * 3_600_000), now)).toBe('within a day')
    expect(describeDue(plus(DAY + 1000), now)).toBe('in 1 day')
    expect(describeDue(plus(120 * DAY), now)).toBe('in 4 months')
  })

  it('counts whole days', () => {
    expect(daysUntil(plus(36 * 3_600_000), now)).toBe(1)
    expect(daysUntil(plus(-1), now)).toBe(-1)
  })
})
