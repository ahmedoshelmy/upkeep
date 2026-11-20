import { ensure } from './errors'
import { MS_PER_DAY, daysBetween } from './time'

/** One meter reading: an odometer in km or an electricity meter in kWh. Values only ever go up. */
export interface Reading {
  readonly at: Date
  readonly value: number
}

export interface ConsumptionPeriod {
  readonly from: Date
  readonly to: Date
  readonly units: number
  readonly perDay: number
}

const byTime = (a: Reading, b: Reading): number => a.at.getTime() - b.at.getTime()

/**
 * A new reading must fit between its neighbours in time: not below any earlier reading and not above any later
 * one (back-filled readings are allowed). Meter rollover and replacement are out of scope.
 */
export function assertMonotonic(existing: readonly Reading[], next: Reading): void {
  ensure(Number.isFinite(next.value) && next.value >= 0, 'A reading must be a non-negative number')
  for (const r of existing) {
    if (r.at.getTime() === next.at.getTime()) ensure(false, 'There is already a reading at that moment')
    if (r.at < next.at) ensure(r.value <= next.value, `Reading ${next.value} is below an earlier reading ${r.value}`)
    if (r.at > next.at) ensure(r.value >= next.value, `Reading ${next.value} is above a later reading ${r.value}`)
  }
}

/** Consumption between consecutive readings (km driven or kWh used per period). */
export function consumptionPerPeriod(readings: readonly Reading[]): ConsumptionPeriod[] {
  const sorted = [...readings].sort(byTime)
  const periods: ConsumptionPeriod[] = []
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]
    const to = sorted[i]
    const units = to.value - from.value
    const days = Math.max(daysBetween(from.at, to.at), 1 / 24)
    periods.push({ from: from.at, to: to.at, units, perDay: units / days })
  }
  return periods
}

export interface UsageProjection {
  readonly lastValue: number
  readonly lastAt: Date
  readonly perDay: number
}

/**
 * Average usage per day over the readings inside the window (default 90 days back from the latest reading).
 * Needs two readings at least a day apart; otherwise there is nothing honest to project from.
 */
export function projectUsage(readings: readonly Reading[], windowDays = 90): UsageProjection | null {
  if (readings.length < 2) return null
  const sorted = [...readings].sort(byTime)
  const last = sorted[sorted.length - 1]
  const windowStart = last.at.getTime() - windowDays * MS_PER_DAY
  const first = sorted.find((r) => r.at.getTime() >= windowStart) ?? sorted[0]
  const days = daysBetween(first.at, last.at)
  if (days < 1) return null
  return { lastValue: last.value, lastAt: last.at, perDay: (last.value - first.value) / days }
}

/** The date the meter is expected to reach `target`, or null when usage is flat (it never will). */
export function dateWhenReaching(projection: UsageProjection, target: number): Date | null {
  if (target <= projection.lastValue) return projection.lastAt
  if (projection.perDay <= 0) return null
  const days = (target - projection.lastValue) / projection.perDay
  return new Date(projection.lastAt.getTime() + days * MS_PER_DAY)
}
