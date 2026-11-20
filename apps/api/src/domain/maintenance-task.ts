import { ensure } from './errors'
import { type Baseline, type IntervalRule, dueDateByTime, dueKm } from './interval-rule'
import { type UsageProjection, dateWhenReaching } from './readings'

export interface MaintenanceTask {
  readonly id: string
  readonly assetId: string
  readonly title: string
  readonly rule: IntervalRule
  readonly baseline: Baseline
  /** A date the owner already knows (a service sticker, a booked visit). Cleared once the task is done. */
  readonly fixedDueAt: Date | null
}

export type DueReason = 'TIME' | 'DISTANCE' | 'FIXED_DATE'

export interface DueEstimate {
  readonly dueAt: Date
  readonly dueKm: number | null
  readonly reason: DueReason
}

export function createTask(props: MaintenanceTask): MaintenanceTask {
  const title = props.title.trim()
  ensure(title.length > 0 && title.length <= 80, 'Task title must be 1 to 80 characters')
  ensure(props.baseline.doneKm === null || props.baseline.doneKm >= 0, 'Odometer cannot be negative')
  ensure(
    props.rule.everyKm === null || props.baseline.doneKm !== null,
    'A km-based interval needs the odometer reading when it was last done',
  )
  return { ...props, title }
}

/**
 * The core rule: the task is due at whichever comes first of
 *  - the time side (last done + every M months),
 *  - the distance side (last done km + every N km, turned into a date with the projected km/day), and
 *  - a fixed date the owner entered.
 * Without readings to project from, the distance side cannot become a date and the time side decides.
 */
export function nextDue(task: MaintenanceTask, usage: UsageProjection | null): DueEstimate | null {
  const candidates: DueEstimate[] = []
  const targetKm = dueKm(task.rule, task.baseline)
  const byTime = dueDateByTime(task.rule, task.baseline)
  if (byTime) candidates.push({ dueAt: byTime, dueKm: targetKm, reason: 'TIME' })
  if (targetKm !== null && usage) {
    const byDistance = dateWhenReaching(usage, targetKm)
    if (byDistance) candidates.push({ dueAt: byDistance, dueKm: targetKm, reason: 'DISTANCE' })
  }
  if (task.fixedDueAt) candidates.push({ dueAt: task.fixedDueAt, dueKm: targetKm, reason: 'FIXED_DATE' })
  if (candidates.length === 0) return null
  return candidates.reduce((first, c) => (c.dueAt < first.dueAt ? c : first))
}

/** Marking a task done resets its baseline; the next due date follows from the rule again. */
export function completeTask(task: MaintenanceTask, doneAt: Date, doneKm: number | null): MaintenanceTask {
  ensure(doneAt >= task.baseline.doneAt, 'Completion cannot be before the previous completion')
  const km = doneKm ?? (task.rule.everyKm === null ? null : task.baseline.doneKm)
  ensure(
    km === null || task.baseline.doneKm === null || km >= task.baseline.doneKm,
    'Odometer at completion cannot be below the previous completion',
  )
  return { ...task, baseline: { doneAt, doneKm: km }, fixedDueAt: null }
}
