import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Hand-written so the schema is reviewable SQL; the API runs it at start-up (migrationsRun). */
export class InitialSchema1763700000000 implements MigrationInterface {
  name = 'InitialSchema1763700000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE assets (
        id uuid PRIMARY KEY,
        kind varchar(20) NOT NULL,
        name varchar(80) NOT NULL,
        created_at timestamptz NOT NULL
      )`)
    await q.query(`
      CREATE TABLE maintenance_tasks (
        id uuid PRIMARY KEY,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        title varchar(80) NOT NULL,
        every_km integer CHECK (every_km > 0),
        every_months integer CHECK (every_months > 0),
        done_at timestamptz NOT NULL,
        done_km double precision,
        fixed_due_at timestamptz,
        CHECK (every_km IS NOT NULL OR every_months IS NOT NULL)
      )`)
    await q.query(`CREATE INDEX ix_tasks_asset ON maintenance_tasks (asset_id)`)
    await q.query(`
      CREATE TABLE readings (
        id uuid PRIMARY KEY,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        meter varchar(20) NOT NULL,
        at timestamptz NOT NULL,
        value double precision NOT NULL CHECK (value >= 0),
        UNIQUE (asset_id, meter, at)
      )`)
    await q.query(`
      CREATE TABLE renewals (
        id uuid PRIMARY KEY,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        kind varchar(20) NOT NULL,
        title varchar(80) NOT NULL,
        expires_at timestamptz NOT NULL
      )`)
    await q.query(`CREATE INDEX ix_renewals_asset ON renewals (asset_id)`)
    await q.query(`
      CREATE TABLE reminders (
        id uuid PRIMARY KEY,
        subject_type varchar(10) NOT NULL,
        subject_id uuid NOT NULL,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        title varchar(80) NOT NULL,
        due_at timestamptz NOT NULL,
        fire_at timestamptz NOT NULL,
        lead_days double precision NOT NULL,
        status varchar(10) NOT NULL
      )`)
    await q.query(`CREATE INDEX ix_reminders_subject ON reminders (subject_id)`)
    await q.query(`CREATE INDEX ix_reminders_pending ON reminders (fire_at) WHERE status = 'SCHEDULED'`)
    await q.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY,
        reminder_id uuid NOT NULL UNIQUE REFERENCES reminders (id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        title varchar(80) NOT NULL,
        message varchar(200) NOT NULL,
        created_at timestamptz NOT NULL,
        read_at timestamptz
      )`)
    await q.query(`CREATE INDEX ix_notifications_recent ON notifications (created_at DESC)`)
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'notifications',
      'reminders',
      'renewals',
      'readings',
      'maintenance_tasks',
      'assets',
    ]) {
      await q.query(`DROP TABLE ${table}`)
    }
  }
}
