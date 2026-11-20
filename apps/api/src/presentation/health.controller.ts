import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { DATA_SOURCE } from '../infrastructure/persistence/sql-repositories'
import { REMINDER_QUEUE } from '../application/ports'
import type { BullReminderQueue } from '../infrastructure/queue/reminder-queue'

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATA_SOURCE) private readonly db: DataSource,
    @Inject(REMINDER_QUEUE) private readonly queue: BullReminderQueue,
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' }
  }

  /** Ready when Postgres answers and the queue's Redis connection answers. */
  @Get('ready')
  async ready(): Promise<{ status: string; postgres: string; redis: string }> {
    try {
      await this.db.query('SELECT 1')
      await this.queue.queue.getJobCounts('waiting')
      return { status: 'ok', postgres: 'up', redis: 'up' }
    } catch (error) {
      throw new ServiceUnavailableException({ status: 'down', reason: (error as Error).message })
    }
  }
}
