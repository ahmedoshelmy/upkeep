import type { MeterKind } from '../domain/asset'
import type { DueReason } from '../domain/maintenance-task'

export type ReminderSubject = 'TASK' | 'RENEWAL'
export type ReminderStatus = 'SCHEDULED' | 'FIRED' | 'CANCELLED' | 'SNOOZED'

/** One planned reminder; the queue holds a delayed job per SCHEDULED row (job id = reminder id). */
export interface Reminder {
  readonly id: string
  readonly subjectType: ReminderSubject
  readonly subjectId: string
  readonly assetId: string
  readonly title: string
  readonly dueAt: Date
  readonly fireAt: Date
  readonly leadDays: number
  readonly status: ReminderStatus
}

/** What the owner sees in the app (and, optionally, by mail) when a reminder fires. */
export interface Notification {
  readonly id: string
  readonly reminderId: string
  readonly assetId: string
  readonly title: string
  readonly message: string
  readonly createdAt: Date
  readonly readAt: Date | null
}

export interface StoredReading {
  readonly id: string
  readonly assetId: string
  readonly meter: MeterKind
  readonly at: Date
  readonly value: number
}

export interface DueItem {
  readonly subjectType: ReminderSubject
  readonly subjectId: string
  readonly assetId: string
  readonly title: string
  readonly dueAt: Date
  readonly dueKm: number | null
  readonly reason: DueReason | 'EXPIRY'
}
