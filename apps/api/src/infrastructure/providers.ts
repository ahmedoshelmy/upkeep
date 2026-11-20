import { Inject, Injectable, type OnApplicationShutdown, type Provider } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { UPKEEP_CONFIG, type UpkeepConfig } from '../config'
import {
  ASSETS,
  CLOCK,
  ID_GENERATOR,
  MAILER,
  NOTIFICATIONS,
  NOTIFICATION_BUS,
  READINGS,
  REMINDERS,
  REMINDER_QUEUE,
  RENEWALS,
  TASKS,
  UPKEEP_SETTINGS,
  type UpkeepSettings,
} from '../application/ports'
import { RedisNotificationBus } from './messaging/redis-notification-bus'
import { SmtpMailer } from './messaging/smtp-mailer'
import { InitialSchema1763700000000 } from './persistence/initial-schema.migration'
import {
  DATA_SOURCE,
  SqlAssetRepository,
  SqlNotificationRepository,
  SqlReadingRepository,
  SqlReminderRepository,
  SqlRenewalRepository,
  SqlTaskRepository,
} from './persistence/sql-repositories'
import { BullReminderQueue, type QueueSettings, redisConnection } from './queue/reminder-queue'
import { systemClock, uuidGenerator } from './system'

export const QUEUE_SETTINGS = Symbol('QueueSettings')
export const NOTIFICATION_CHANNEL = 'upkeep:notifications'

/** Closes pools and Redis connections after Nest stopped everything else. */
@Injectable()
export class Connections implements OnApplicationShutdown {
  constructor(
    @Inject(DATA_SOURCE) private readonly db: DataSource,
    @Inject(REMINDER_QUEUE) private readonly queue: BullReminderQueue,
    @Inject(NOTIFICATION_BUS) private readonly bus: RedisNotificationBus,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.queue.close(), this.bus.close()])
    if (this.db.isInitialized) await this.db.destroy()
  }
}

/** Every adapter behind an application port; shared by the API and the worker. */
export function infrastructureProviders(config: UpkeepConfig): Provider[] {
  const queueSettings: QueueSettings = {
    connection: redisConnection(config.redisUrl),
    prefix: config.queuePrefix,
    attempts: config.reminderAttempts,
    backoffMs: config.reminderBackoffMs,
  }
  const settings: UpkeepSettings = { leadDays: config.leadDays, tariff: config.tariff }
  return [
    { provide: UPKEEP_CONFIG, useValue: config },
    { provide: UPKEEP_SETTINGS, useValue: settings },
    { provide: QUEUE_SETTINGS, useValue: queueSettings },
    { provide: CLOCK, useValue: systemClock },
    { provide: ID_GENERATOR, useValue: uuidGenerator },
    {
      provide: DATA_SOURCE,
      useFactory: () =>
        new DataSource({
          type: 'postgres',
          url: config.databaseUrl,
          migrations: [InitialSchema1763700000000],
          migrationsRun: true,
          extra: { max: 10 },
        }).initialize(),
    },
    { provide: ASSETS, useClass: SqlAssetRepository },
    { provide: TASKS, useClass: SqlTaskRepository },
    { provide: READINGS, useClass: SqlReadingRepository },
    { provide: RENEWALS, useClass: SqlRenewalRepository },
    { provide: REMINDERS, useClass: SqlReminderRepository },
    { provide: NOTIFICATIONS, useClass: SqlNotificationRepository },
    { provide: REMINDER_QUEUE, useFactory: () => new BullReminderQueue(queueSettings) },
    {
      provide: NOTIFICATION_BUS,
      useFactory: () => new RedisNotificationBus(config.redisUrl, NOTIFICATION_CHANNEL),
    },
    { provide: MAILER, useFactory: () => new SmtpMailer(config.mailSmtpUrl, config.mailFrom, config.mailTo) },
    Connections,
  ]
}
