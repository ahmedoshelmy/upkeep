import type { Asset } from '../domain/asset'
import type { FuelUp } from '../domain/fuel'
import type { MaintenanceTask } from '../domain/maintenance-task'
import type { Renewal } from '../domain/renewal'
import type {
  AssetRepository,
  Clock,
  FuelUpRepository,
  IdGenerator,
  Mailer,
  NotificationBus,
  NotificationRepository,
  ReadingRepository,
  ReminderQueue,
  ReminderRepository,
  RenewalRepository,
  TaskRepository,
} from './ports'
import type { Notification, Reminder, StoredReading } from './records'

/** Hand-rolled fakes for handler tests: plain maps, a settable clock and a queue that records what it was asked. */
export class FakeClock implements Clock {
  readonly slept: number[] = []
  constructor(public current: Date) {}
  now(): Date {
    return this.current
  }
  async sleep(ms: number): Promise<void> {
    this.slept.push(ms)
    this.current = new Date(this.current.getTime() + ms)
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0
  next(): string {
    return `id-${++this.n}`
  }
}

export class MemoryAssets implements AssetRepository {
  readonly rows = new Map<string, Asset>()
  async save(a: Asset): Promise<void> {
    this.rows.set(a.id, a)
  }
  async find(id: string): Promise<Asset | null> {
    return this.rows.get(id) ?? null
  }
  async findMany(ids: readonly string[]): Promise<Asset[]> {
    return ids.flatMap((id) => this.rows.get(id) ?? [])
  }
  async list(): Promise<Asset[]> {
    return [...this.rows.values()]
  }
}

export class MemoryTasks implements TaskRepository {
  readonly rows = new Map<string, MaintenanceTask>()
  async save(t: MaintenanceTask): Promise<void> {
    this.rows.set(t.id, t)
  }
  async find(id: string): Promise<MaintenanceTask | null> {
    return this.rows.get(id) ?? null
  }
  async listByAssets(ids: readonly string[]): Promise<MaintenanceTask[]> {
    return [...this.rows.values()].filter((t) => ids.includes(t.assetId))
  }
  async listAll(): Promise<MaintenanceTask[]> {
    return [...this.rows.values()]
  }
}

export class MemoryReadings implements ReadingRepository {
  readonly rows: StoredReading[] = []
  async add(r: StoredReading): Promise<void> {
    this.rows.push(r)
  }
  async listByAssets(ids: readonly string[]): Promise<StoredReading[]> {
    return this.rows.filter((r) => ids.includes(r.assetId))
  }
}

export class MemoryFuelUps implements FuelUpRepository {
  readonly rows: FuelUp[] = []
  constructor(private readonly readings: MemoryReadings) {}
  async addWithReading(f: FuelUp, reading: StoredReading): Promise<void> {
    await this.readings.add(reading)
    this.rows.push(f)
  }
  async listByAssets(ids: readonly string[]): Promise<FuelUp[]> {
    return this.rows.filter((f) => ids.includes(f.assetId))
  }
}

export class MemoryRenewals implements RenewalRepository {
  readonly rows = new Map<string, Renewal>()
  async save(r: Renewal): Promise<void> {
    this.rows.set(r.id, r)
  }
  async find(id: string): Promise<Renewal | null> {
    return this.rows.get(id) ?? null
  }
  async listByAssets(ids: readonly string[]): Promise<Renewal[]> {
    return [...this.rows.values()].filter((r) => ids.includes(r.assetId))
  }
  async listAll(): Promise<Renewal[]> {
    return [...this.rows.values()]
  }
}

export class MemoryReminders implements ReminderRepository {
  readonly rows = new Map<string, Reminder>()
  async replacePlan(subjectId: string, plan: readonly Reminder[]): Promise<string[]> {
    const cancelled: string[] = []
    for (const r of this.rows.values()) {
      if (r.subjectId === subjectId && r.status === 'SCHEDULED') {
        this.rows.set(r.id, { ...r, status: 'CANCELLED' })
        cancelled.push(r.id)
      }
    }
    for (const r of plan) this.rows.set(r.id, r)
    return cancelled
  }
  async add(r: Reminder): Promise<void> {
    this.rows.set(r.id, r)
  }
  async find(id: string): Promise<Reminder | null> {
    return this.rows.get(id) ?? null
  }
  async setStatus(id: string, status: Reminder['status']): Promise<void> {
    const r = this.rows.get(id)
    if (r) this.rows.set(id, { ...r, status })
  }
  async listBySubjects(ids: readonly string[]): Promise<Reminder[]> {
    return [...this.rows.values()].filter((r) => ids.includes(r.subjectId))
  }
  async listOverdueScheduled(now: Date, graceMs: number): Promise<Reminder[]> {
    return [...this.rows.values()].filter(
      (r) => r.status === 'SCHEDULED' && r.fireAt.getTime() < now.getTime() - graceMs,
    )
  }
}

export class MemoryNotifications implements NotificationRepository {
  readonly rows: Notification[] = []
  constructor(private readonly reminders: MemoryReminders) {}
  async recordFired(n: Notification): Promise<boolean> {
    if (this.rows.some((r) => r.reminderId === n.reminderId)) return false
    this.rows.push(n)
    await this.reminders.setStatus(n.reminderId, 'FIRED')
    return true
  }
  async list(limit: number): Promise<Notification[]> {
    return this.rows.slice(0, limit)
  }
  async markRead(id: string, at: Date): Promise<Notification | null> {
    const i = this.rows.findIndex((n) => n.id === id)
    if (i < 0) return null
    this.rows[i] = { ...this.rows[i], readAt: this.rows[i].readAt ?? at }
    return this.rows[i]
  }
}

export class RecordingQueue implements ReminderQueue {
  readonly scheduled: { reminderId: string; delayMs: number }[] = []
  readonly cancelled: string[] = []
  /** The next n schedule calls throw, like a Redis blip. */
  failNextSchedules = 0
  async schedule(reminderId: string, delayMs: number): Promise<void> {
    if (this.failNextSchedules > 0) {
      this.failNextSchedules--
      throw new Error('redis unavailable')
    }
    this.scheduled.push({ reminderId, delayMs })
  }
  async cancel(ids: readonly string[]): Promise<void> {
    this.cancelled.push(...ids)
  }
}

export class RecordingBus implements NotificationBus {
  readonly published: Notification[] = []
  async publish(n: Notification): Promise<void> {
    this.published.push(n)
  }
  async subscribe(): Promise<void> {}
}

export class FailingMailer implements Mailer {
  attempts = 0
  async send(): Promise<void> {
    this.attempts++
    throw new Error('smtp down')
  }
}
