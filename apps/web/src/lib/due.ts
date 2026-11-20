export type Urgency = 'overdue' | 'soon' | 'later'

const DAY = 86_400_000

/** Whole days from now until `dueAt` (negative when overdue), rounded towards "sooner". */
export function daysUntil(dueAt: string | Date, now: Date): number {
  return Math.floor((new Date(dueAt).getTime() - now.getTime()) / DAY)
}

export function urgencyOf(dueAt: string | Date, now: Date, soonDays = 7): Urgency {
  const days = daysUntil(dueAt, now)
  if (new Date(dueAt).getTime() <= now.getTime()) return 'overdue'
  return days < soonDays ? 'soon' : 'later'
}

export function describeDue(dueAt: string | Date, now: Date): string {
  const ms = new Date(dueAt).getTime() - now.getTime()
  if (ms <= 0) {
    const late = Math.floor(-ms / DAY)
    return late === 0 ? 'due today' : `overdue by ${late} day${late === 1 ? '' : 's'}`
  }
  if (ms < DAY) return ms < 3_600_000 ? `in ${Math.max(1, Math.round(ms / 60_000))} min` : 'within a day'
  const days = Math.floor(ms / DAY)
  if (days < 60) return `in ${days} day${days === 1 ? '' : 's'}`
  return `in ${Math.round(days / 30)} months`
}

export const REASON_LABEL: Record<string, string> = {
  TIME: 'by date',
  DISTANCE: 'by km (projected)',
  FIXED_DATE: 'booked date',
  EXPIRY: 'expiry',
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}
