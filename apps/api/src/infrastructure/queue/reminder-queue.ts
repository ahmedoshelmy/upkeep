import { Queue, type ConnectionOptions } from 'bullmq'
import type { ReminderQueue } from '../../application/ports'

export const REMINDER_QUEUE_NAME = 'reminders'
export const DEAD_LETTER_QUEUE_NAME = 'reminders-dead'
export const FIRE_JOB = 'fire'
export const SWEEP_JOB = 'sweep'

export interface FireJobData {
  readonly reminderId: string
}

export interface QueueSettings {
  readonly connection: ConnectionOptions
  readonly prefix: string
  readonly attempts: number
  readonly backoffMs: number
}

/** Parses redis://[:password@]host:port[/db] into BullMQ connection options (it opens its own connections). */
export function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  }
}

/**
 * One delayed job per reminder, with the reminder id as job id: scheduling twice is a no-op and cancelling is a
 * direct remove. Retries use exponential backoff; the worker moves jobs that used up their attempts to the
 * dead-letter queue.
 */
export class BullReminderQueue implements ReminderQueue {
  readonly queue: Queue<FireJobData>

  constructor(private readonly settings: QueueSettings) {
    this.queue = new Queue<FireJobData>(REMINDER_QUEUE_NAME, {
      connection: settings.connection,
      prefix: settings.prefix,
    })
  }

  async schedule(reminderId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      FIRE_JOB,
      { reminderId },
      {
        jobId: reminderId,
        delay: delayMs,
        attempts: this.settings.attempts,
        backoff: { type: 'exponential', delay: this.settings.backoffMs },
        removeOnComplete: { age: 7 * 86_400, count: 1000 },
        removeOnFail: { age: 30 * 86_400 },
      },
    )
  }

  async cancel(reminderIds: readonly string[]): Promise<void> {
    // A job that is already running cannot be removed; the handler skips reminders that are no longer SCHEDULED.
    await Promise.all(reminderIds.map((id) => this.queue.remove(id).catch(() => 0)))
  }

  close(): Promise<void> {
    return this.queue.close()
  }
}
