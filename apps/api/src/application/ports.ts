import type { Asset } from '../domain/asset'
import type { MaintenanceTask } from '../domain/maintenance-task'
import type { Renewal } from '../domain/renewal'
import type { TariffTable } from '../domain/tariff'
import type { Notification, Reminder, StoredReading } from './records'
import type { RetryPolicy } from './retry'

export const CLOCK = Symbol('Clock')
export interface Clock {
  now(): Date
  /** Waits (retry backoff). The test clock just moves its time forward. */
  sleep(ms: number): Promise<void>
}

export const ID_GENERATOR = Symbol('IdGenerator')
export interface IdGenerator {
  next(): string
}

export const ASSETS = Symbol('AssetRepository')
export interface AssetRepository {
  save(asset: Asset): Promise<void>
  find(id: string): Promise<Asset | null>
  findMany(ids: readonly string[]): Promise<Asset[]>
  list(): Promise<Asset[]>
}

export const TASKS = Symbol('TaskRepository')
export interface TaskRepository {
  save(task: MaintenanceTask): Promise<void>
  find(id: string): Promise<MaintenanceTask | null>
  listByAssets(assetIds: readonly string[]): Promise<MaintenanceTask[]>
  listAll(): Promise<MaintenanceTask[]>
}

export const READINGS = Symbol('ReadingRepository')
export interface ReadingRepository {
  add(reading: StoredReading): Promise<void>
  listByAssets(assetIds: readonly string[]): Promise<StoredReading[]>
}

export const RENEWALS = Symbol('RenewalRepository')
export interface RenewalRepository {
  save(renewal: Renewal): Promise<void>
  find(id: string): Promise<Renewal | null>
  listByAssets(assetIds: readonly string[]): Promise<Renewal[]>
  listAll(): Promise<Renewal[]>
}

export const REMINDERS = Symbol('ReminderRepository')
export interface ReminderRepository {
  /** Cancels the subject's pending reminders and stores the new plan, atomically; returns the cancelled ids. */
  replacePlan(subjectId: string, plan: readonly Reminder[]): Promise<string[]>
  add(reminder: Reminder): Promise<void>
  find(id: string): Promise<Reminder | null>
  setStatus(id: string, status: Reminder['status']): Promise<void>
  listBySubjects(subjectIds: readonly string[]): Promise<Reminder[]>
  /** SCHEDULED reminders whose moment passed: the sweep re-enqueues them in case a job was lost. */
  listOverdueScheduled(now: Date, graceMs: number): Promise<Reminder[]>
}

export const NOTIFICATIONS = Symbol('NotificationRepository')
export interface NotificationRepository {
  /** Stores the notification and marks its reminder FIRED in one transaction; false if it already existed. */
  recordFired(notification: Notification): Promise<boolean>
  list(limit: number, unreadOnly: boolean): Promise<Notification[]>
  markRead(id: string, at: Date): Promise<Notification | null>
}

export const REMINDER_QUEUE = Symbol('ReminderQueue')
export interface ReminderQueue {
  schedule(reminderId: string, delayMs: number): Promise<void>
  cancel(reminderIds: readonly string[]): Promise<void>
}

export const NOTIFICATION_BUS = Symbol('NotificationBus')
/** Fan-out of fired notifications from the worker to every API instance (and on to subscribed clients). */
export interface NotificationBus {
  publish(notification: Notification): Promise<void>
  subscribe(listener: (notification: Notification) => void): Promise<void>
}

export const MAILER = Symbol('Mailer')
export interface Mailer {
  send(notification: Notification): Promise<void>
}

export const UPKEEP_SETTINGS = Symbol('UpkeepSettings')
export interface UpkeepSettings {
  readonly leadDays: readonly number[]
  readonly tariff: TariffTable
  /** Retries of a reminder (re)plan when Postgres or Redis hiccups; the saga has no other retry. */
  readonly planRetry: RetryPolicy
}
