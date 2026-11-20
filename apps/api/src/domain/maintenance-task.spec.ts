import { DomainError } from './errors'
import { intervalRule } from './interval-rule'
import { type MaintenanceTask, completeTask, createTask, nextDue } from './maintenance-task'
import type { UsageProjection } from './readings'

const jan1 = new Date('2026-01-01T00:00:00Z')

function oilChange(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return createTask({
    id: 't1',
    assetId: 'a1',
    title: 'Oil change',
    rule: intervalRule(5000, 6),
    baseline: { doneAt: jan1, doneKm: 40_000 },
    fixedDueAt: null,
    ...overrides,
  })
}

const driving = (perDay: number): UsageProjection => ({ lastValue: 40_000, lastAt: jan1, perDay })

describe('interval rule, whichever comes first', () => {
  it('uses the time side when there are no readings to project km from', () => {
    const due = nextDue(oilChange(), null)
    expect(due).toEqual({ dueAt: new Date('2026-07-01T00:00:00Z'), dueKm: 45_000, reason: 'TIME' })
  })

  it('picks distance when the car is driven a lot', () => {
    const due = nextDue(oilChange(), driving(100))
    expect(due?.reason).toBe('DISTANCE')
    expect(due?.dueAt).toEqual(new Date('2026-02-20T00:00:00Z'))
  })

  it('picks time when the car is barely driven', () => {
    const due = nextDue(oilChange(), driving(10))
    expect(due?.reason).toBe('TIME')
    expect(due?.dueAt).toEqual(new Date('2026-07-01T00:00:00Z'))
  })

  it('treats a car that is not driven at all as due by time only', () => {
    expect(nextDue(oilChange(), driving(0))?.reason).toBe('TIME')
  })

  it('lets a known earlier date win', () => {
    const fixed = new Date('2026-01-15T09:00:00Z')
    const due = nextDue(oilChange({ fixedDueAt: fixed }), driving(10))
    expect(due).toMatchObject({ dueAt: fixed, reason: 'FIXED_DATE' })
  })

  it('works with a km-only rule', () => {
    const task = oilChange({ rule: intervalRule(10_000, null) })
    expect(nextDue(task, null)).toBeNull()
    expect(nextDue(task, driving(50))?.dueAt).toEqual(new Date('2026-07-20T00:00:00Z'))
  })

  it('clamps month ends (31 Jan + 1 month is the end of February)', () => {
    const task = oilChange({
      rule: intervalRule(null, 1),
      baseline: { doneAt: new Date('2026-01-31T00:00:00Z'), doneKm: null },
    })
    expect(nextDue(task, null)?.dueAt).toEqual(new Date('2026-02-28T00:00:00Z'))
  })

  it('rejects rules without any interval and km rules without a baseline km', () => {
    expect(() => intervalRule(null, null)).toThrow(DomainError)
    expect(() => intervalRule(-5, null)).toThrow(DomainError)
    expect(() => intervalRule(null, 0)).toThrow(DomainError)
    expect(() => oilChange({ baseline: { doneAt: jan1, doneKm: null } })).toThrow(DomainError)
  })

  it('completing resets the baseline and clears a fixed date', () => {
    const done = completeTask(oilChange({ fixedDueAt: jan1 }), new Date('2026-03-01T00:00:00Z'), 44_000)
    expect(done.fixedDueAt).toBeNull()
    expect(nextDue(done, null)).toMatchObject({ dueKm: 49_000, dueAt: new Date('2026-09-01T00:00:00Z') })
  })

  it('refuses a completion before the previous one or with a lower odometer', () => {
    expect(() => completeTask(oilChange(), new Date('2025-12-01T00:00:00Z'), 41_000)).toThrow(DomainError)
    expect(() => completeTask(oilChange(), new Date('2026-02-01T00:00:00Z'), 39_000)).toThrow(DomainError)
  })
})
