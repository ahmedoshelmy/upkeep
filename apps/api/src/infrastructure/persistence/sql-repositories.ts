import { Inject, Injectable } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import type { Asset, AssetKind, MeterKind } from '../../domain/asset'
import type { MaintenanceTask } from '../../domain/maintenance-task'
import type { Renewal, RenewalKind } from '../../domain/renewal'
import type {
  AssetRepository,
  NotificationRepository,
  ReadingRepository,
  ReminderRepository,
  RenewalRepository,
  TaskRepository,
} from '../../application/ports'
import type {
  Notification,
  Reminder,
  ReminderStatus,
  ReminderSubject,
  StoredReading,
} from '../../application/records'

export const DATA_SOURCE = Symbol('DataSource')

/* Rows come back from pg with snake_case keys; numbers stored as double precision arrive as JS numbers. */
type Row = Record<string, unknown>
const date = (v: unknown): Date => new Date(v as string | Date)
const dateOrNull = (v: unknown): Date | null => (v === null ? null : date(v))
const numOrNull = (v: unknown): number | null => (v === null ? null : Number(v))

const toAsset = (r: Row): Asset => ({
  id: r.id as string,
  kind: r.kind as AssetKind,
  name: r.name as string,
  createdAt: date(r.created_at),
})

const toTask = (r: Row): MaintenanceTask => ({
  id: r.id as string,
  assetId: r.asset_id as string,
  title: r.title as string,
  rule: { everyKm: numOrNull(r.every_km), everyMonths: numOrNull(r.every_months) },
  baseline: { doneAt: date(r.done_at), doneKm: numOrNull(r.done_km) },
  fixedDueAt: dateOrNull(r.fixed_due_at),
})

const toReading = (r: Row): StoredReading => ({
  id: r.id as string,
  assetId: r.asset_id as string,
  meter: r.meter as MeterKind,
  at: date(r.at),
  value: Number(r.value),
})

const toRenewal = (r: Row): Renewal => ({
  id: r.id as string,
  assetId: r.asset_id as string,
  kind: r.kind as RenewalKind,
  title: r.title as string,
  expiresAt: date(r.expires_at),
})

const toReminder = (r: Row): Reminder => ({
  id: r.id as string,
  subjectType: r.subject_type as ReminderSubject,
  subjectId: r.subject_id as string,
  assetId: r.asset_id as string,
  title: r.title as string,
  dueAt: date(r.due_at),
  fireAt: date(r.fire_at),
  leadDays: Number(r.lead_days),
  status: r.status as ReminderStatus,
})

const toNotification = (r: Row): Notification => ({
  id: r.id as string,
  reminderId: r.reminder_id as string,
  assetId: r.asset_id as string,
  title: r.title as string,
  message: r.message as string,
  createdAt: date(r.created_at),
  readAt: dateOrNull(r.read_at),
})

@Injectable()
export class SqlAssetRepository implements AssetRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  async save(a: Asset): Promise<void> {
    await this.db.query(
      `INSERT INTO assets (id, kind, name, created_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [a.id, a.kind, a.name, a.createdAt],
    )
  }

  async find(id: string): Promise<Asset | null> {
    const rows: Row[] = await this.db.query(`SELECT * FROM assets WHERE id = $1`, [id])
    return rows[0] ? toAsset(rows[0]) : null
  }

  async findMany(ids: readonly string[]): Promise<Asset[]> {
    if (ids.length === 0) return []
    const rows: Row[] = await this.db.query(`SELECT * FROM assets WHERE id = ANY($1::uuid[])`, [ids])
    return rows.map(toAsset)
  }

  async list(): Promise<Asset[]> {
    const rows: Row[] = await this.db.query(`SELECT * FROM assets ORDER BY created_at, id`)
    return rows.map(toAsset)
  }
}

@Injectable()
export class SqlTaskRepository implements TaskRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  async save(t: MaintenanceTask): Promise<void> {
    await this.db.query(
      `INSERT INTO maintenance_tasks (id, asset_id, title, every_km, every_months, done_at, done_km, fixed_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, every_km = EXCLUDED.every_km,
         every_months = EXCLUDED.every_months, done_at = EXCLUDED.done_at, done_km = EXCLUDED.done_km,
         fixed_due_at = EXCLUDED.fixed_due_at`,
      [
        t.id,
        t.assetId,
        t.title,
        t.rule.everyKm,
        t.rule.everyMonths,
        t.baseline.doneAt,
        t.baseline.doneKm,
        t.fixedDueAt,
      ],
    )
  }

  async find(id: string): Promise<MaintenanceTask | null> {
    const rows: Row[] = await this.db.query(`SELECT * FROM maintenance_tasks WHERE id = $1`, [id])
    return rows[0] ? toTask(rows[0]) : null
  }

  async listByAssets(assetIds: readonly string[]): Promise<MaintenanceTask[]> {
    if (assetIds.length === 0) return []
    const rows: Row[] = await this.db.query(
      `SELECT * FROM maintenance_tasks WHERE asset_id = ANY($1::uuid[]) ORDER BY title, id`,
      [assetIds],
    )
    return rows.map(toTask)
  }

  async listAll(): Promise<MaintenanceTask[]> {
    const rows: Row[] = await this.db.query(`SELECT * FROM maintenance_tasks ORDER BY title, id`)
    return rows.map(toTask)
  }
}

@Injectable()
export class SqlReadingRepository implements ReadingRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  async add(r: StoredReading): Promise<void> {
    await this.db.query(`INSERT INTO readings (id, asset_id, meter, at, value) VALUES ($1, $2, $3, $4, $5)`, [
      r.id,
      r.assetId,
      r.meter,
      r.at,
      r.value,
    ])
  }

  async listByAssets(assetIds: readonly string[]): Promise<StoredReading[]> {
    if (assetIds.length === 0) return []
    const rows: Row[] = await this.db.query(
      `SELECT * FROM readings WHERE asset_id = ANY($1::uuid[]) ORDER BY at`,
      [assetIds],
    )
    return rows.map(toReading)
  }
}

@Injectable()
export class SqlRenewalRepository implements RenewalRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  async save(r: Renewal): Promise<void> {
    await this.db.query(
      `INSERT INTO renewals (id, asset_id, kind, title, expires_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, expires_at = EXCLUDED.expires_at`,
      [r.id, r.assetId, r.kind, r.title, r.expiresAt],
    )
  }

  async find(id: string): Promise<Renewal | null> {
    const rows: Row[] = await this.db.query(`SELECT * FROM renewals WHERE id = $1`, [id])
    return rows[0] ? toRenewal(rows[0]) : null
  }

  async listByAssets(assetIds: readonly string[]): Promise<Renewal[]> {
    if (assetIds.length === 0) return []
    const rows: Row[] = await this.db.query(
      `SELECT * FROM renewals WHERE asset_id = ANY($1::uuid[]) ORDER BY expires_at`,
      [assetIds],
    )
    return rows.map(toRenewal)
  }

  async listAll(): Promise<Renewal[]> {
    const rows: Row[] = await this.db.query(`SELECT * FROM renewals ORDER BY expires_at`)
    return rows.map(toRenewal)
  }
}

const INSERT_REMINDER = `INSERT INTO reminders
  (id, subject_type, subject_id, asset_id, title, due_at, fire_at, lead_days, status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

const reminderParams = (r: Reminder): unknown[] => [
  r.id,
  r.subjectType,
  r.subjectId,
  r.assetId,
  r.title,
  r.dueAt,
  r.fireAt,
  r.leadDays,
  r.status,
]

@Injectable()
export class SqlReminderRepository implements ReminderRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  replacePlan(subjectId: string, plan: readonly Reminder[]): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const cancelled: Row[] = await tx.query(
        `UPDATE reminders SET status = 'CANCELLED' WHERE subject_id = $1 AND status = 'SCHEDULED' RETURNING id`,
        [subjectId],
      )
      for (const reminder of plan) await tx.query(INSERT_REMINDER, reminderParams(reminder))
      // TypeORM returns [rows, affectedCount] for UPDATE ... RETURNING on Postgres.
      const rows = (Array.isArray(cancelled[0]) ? cancelled[0] : cancelled) as Row[]
      return rows.map((r) => r.id as string)
    })
  }

  async add(reminder: Reminder): Promise<void> {
    await this.db.query(INSERT_REMINDER, reminderParams(reminder))
  }

  async find(id: string): Promise<Reminder | null> {
    const rows: Row[] = await this.db.query(`SELECT * FROM reminders WHERE id = $1`, [id])
    return rows[0] ? toReminder(rows[0]) : null
  }

  async setStatus(id: string, status: ReminderStatus): Promise<void> {
    await this.db.query(`UPDATE reminders SET status = $2 WHERE id = $1`, [id, status])
  }

  async listBySubjects(subjectIds: readonly string[]): Promise<Reminder[]> {
    if (subjectIds.length === 0) return []
    const rows: Row[] = await this.db.query(
      `SELECT * FROM reminders WHERE subject_id = ANY($1::uuid[]) ORDER BY fire_at`,
      [subjectIds],
    )
    return rows.map(toReminder)
  }

  async listOverdueScheduled(now: Date, graceMs: number): Promise<Reminder[]> {
    const rows: Row[] = await this.db.query(
      `SELECT * FROM reminders WHERE status = 'SCHEDULED' AND fire_at < $1 ORDER BY fire_at LIMIT 500`,
      [new Date(now.getTime() - graceMs)],
    )
    return rows.map(toReminder)
  }
}

@Injectable()
export class SqlNotificationRepository implements NotificationRepository {
  constructor(@Inject(DATA_SOURCE) private readonly db: DataSource) {}

  recordFired(n: Notification): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const inserted: Row[] = await tx.query(
        `INSERT INTO notifications (id, reminder_id, asset_id, title, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (reminder_id) DO NOTHING RETURNING id`,
        [n.id, n.reminderId, n.assetId, n.title, n.message, n.createdAt],
      )
      await tx.query(`UPDATE reminders SET status = 'FIRED' WHERE id = $1 AND status = 'SCHEDULED'`, [
        n.reminderId,
      ])
      return inserted.length > 0
    })
  }

  async list(limit: number, unreadOnly: boolean): Promise<Notification[]> {
    const rows: Row[] = await this.db.query(
      `SELECT * FROM notifications WHERE ($2::boolean = false OR read_at IS NULL)
       ORDER BY created_at DESC, id LIMIT $1`,
      [limit, unreadOnly],
    )
    return rows.map(toNotification)
  }

  async markRead(id: string, at: Date): Promise<Notification | null> {
    const rows: Row[] = await this.db.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, $2) WHERE id = $1 RETURNING *`,
      [id, at],
    )
    const updated = (Array.isArray(rows[0]) ? rows[0] : rows) as Row[]
    return updated[0] ? toNotification(updated[0]) : null
  }
}
