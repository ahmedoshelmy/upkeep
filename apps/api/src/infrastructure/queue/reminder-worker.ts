import { Logger } from '@nestjs/common'
import type { CommandBus } from '@nestjs/cqrs'
import { type Job, Queue, Worker } from 'bullmq'
import { FireReminderCommand, SweepRemindersCommand } from '../../application/commands'
import {
  DEAD_LETTER_QUEUE_NAME,
  FIRE_JOB,
  type FireJobData,
  type QueueSettings,
  REMINDER_QUEUE_NAME,
  SWEEP_JOB,
} from './reminder-queue'

export interface DeadLetter {
  readonly jobId: string | undefined
  readonly name: string
  readonly data: unknown
  readonly attemptsMade: number
  readonly failedReason: string
}

/**
 * The consumer side. Several worker processes can run this against one Redis (competing consumers): BullMQ hands
 * each job to exactly one of them and re-delivers it if that worker dies holding the lock.
 */
export class ReminderWorker {
  private readonly logger = new Logger(ReminderWorker.name)
  private readonly worker: Worker
  readonly deadLetters: Queue<DeadLetter>
  private readonly reminders: Queue

  constructor(
    private readonly settings: QueueSettings & {
      readonly concurrency: number
      readonly sweepEveryMs: number
    },
    private readonly commands: CommandBus,
  ) {
    const base = { connection: settings.connection, prefix: settings.prefix }
    this.deadLetters = new Queue<DeadLetter>(DEAD_LETTER_QUEUE_NAME, base)
    this.reminders = new Queue(REMINDER_QUEUE_NAME, base)
    this.worker = new Worker(REMINDER_QUEUE_NAME, (job) => this.process(job), {
      ...base,
      concurrency: settings.concurrency,
      autorun: false,
    })
    this.worker.on('failed', (job, error) => void this.onFailed(job, error))
    this.worker.on('error', (error) => this.logger.error(error.message))
  }

  async start(): Promise<void> {
    // A repeatable job (job scheduler): one sweep per interval across all workers, not one per process.
    await this.reminders.upsertJobScheduler(
      SWEEP_JOB,
      { every: this.settings.sweepEveryMs },
      { name: SWEEP_JOB },
    )
    void this.worker.run()
    await this.worker.waitUntilReady()
  }

  private async process(job: Job): Promise<unknown> {
    if (job.name === SWEEP_JOB) return this.commands.execute(new SweepRemindersCommand())
    if (job.name !== FIRE_JOB) throw new Error(`Unknown job ${job.name}`)
    const { reminderId } = job.data as FireJobData
    const notification = await this.commands.execute(new FireReminderCommand(reminderId))
    return notification ? { notificationId: (notification as { id: string }).id } : { skipped: true }
  }

  private async onFailed(job: Job | undefined, error: Error): Promise<void> {
    if (!job) return
    const attempts = job.opts.attempts ?? 1
    if (job.attemptsMade < attempts) {
      this.logger.warn(`job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}): ${error.message}`)
      return
    }
    this.logger.error(`job ${job.id} dead-lettered after ${job.attemptsMade} attempts: ${error.message}`)
    await this.deadLetters.add('dead', {
      jobId: job.id,
      name: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: error.message,
    })
  }

  async close(): Promise<void> {
    await this.worker.close()
    await Promise.all([this.deadLetters.close(), this.reminders.close()])
  }
}
