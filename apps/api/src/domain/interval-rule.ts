import { ensure } from './errors'
import { addMonths } from './time'

/** "Every N km or every M months, whichever comes first". At least one side is required. */
export interface IntervalRule {
  readonly everyKm: number | null
  readonly everyMonths: number | null
}

/** When the task was last done (or when tracking started), and the odometer at that moment. */
export interface Baseline {
  readonly doneAt: Date
  readonly doneKm: number | null
}

export function intervalRule(everyKm: number | null, everyMonths: number | null): IntervalRule {
  ensure(everyKm !== null || everyMonths !== null, 'A task needs an interval in km, in months, or both')
  ensure(everyKm === null || (Number.isInteger(everyKm) && everyKm > 0), 'everyKm must be a positive integer')
  ensure(
    everyMonths === null || (Number.isInteger(everyMonths) && everyMonths > 0 && everyMonths <= 120),
    'everyMonths must be a whole number from 1 to 120',
  )
  return { everyKm, everyMonths }
}

/** The odometer value at which the task falls due, when the rule has a km side and the baseline knows the km. */
export function dueKm(rule: IntervalRule, baseline: Baseline): number | null {
  if (rule.everyKm === null || baseline.doneKm === null) return null
  return baseline.doneKm + rule.everyKm
}

/** The calendar date on which the task falls due by time alone. */
export function dueDateByTime(rule: IntervalRule, baseline: Baseline): Date | null {
  return rule.everyMonths === null ? null : addMonths(baseline.doneAt, rule.everyMonths)
}
