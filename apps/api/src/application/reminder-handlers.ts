import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs'
import { delayUntil, planReminders, snoozeUntil } from '../domain/reminder-schedule'
import {
  FireReminderCommand,
  MarkNotificationReadCommand,
  PlanRenewalRemindersCommand,
  PlanTaskRemindersCommand,
  ReplanAssetCommand,
  SnoozeReminderCommand,
  SweepRemindersCommand,
} from './commands'
import { DueCalculator } from './due-calculator'
import { NotFoundError, ReminderNotVisibleError } from './errors'
import { ReminderFired } from './events'
import {
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
  MAILER,
  type Mailer,
  NOTIFICATIONS,
  NOTIFICATION_BUS,
  type NotificationBus,
  type NotificationRepository,
  REMINDERS,
  REMINDER_QUEUE,
  RENEWALS,
  type ReminderQueue,
  type ReminderRepository,
  type RenewalRepository,
  TASKS,
  type TaskRepository,
  UPKEEP_SETTINGS,
  type UpkeepSettings,
} from './ports'
import type { Notification, Reminder, ReminderSubject } from './records'

interface DueSubject {
  readonly subjectType: ReminderSubject
  readonly subjectId: string
  readonly assetId: string
  readonly title: string
  readonly dueAt: Date
}

/** Replaces a subject's reminder plan: cancel what was pending, store the new rows, enqueue one delayed job each. */
class ReminderPlanner {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly queue: ReminderQueue,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly leadDays: readonly number[],
  ) {}

  async replan(subject: DueSubject | null, subjectId: string): Promise<Reminder[]> {
    const now = this.clock.now()
    const plan: Reminder[] = subject
      ? planReminders(subject.dueAt, this.leadDays, now).map((p) => ({
          ...subject,
          id: this.ids.next(),
          fireAt: p.fireAt,
          leadDays: p.leadDays,
          status: 'SCHEDULED',
        }))
      : []
    const cancelled = await this.reminders.replacePlan(subjectId, plan)
    await this.queue.cancel(cancelled)
    for (const reminder of plan) await this.queue.schedule(reminder.id, delayUntil(reminder.fireAt, now))
    return plan
  }
}

abstract class PlanningHandler {
  protected readonly planner: ReminderPlanner

  constructor(
    reminders: ReminderRepository,
    queue: ReminderQueue,
    ids: IdGenerator,
    clock: Clock,
    settings: UpkeepSettings,
  ) {
    this.planner = new ReminderPlanner(reminders, queue, ids, clock, settings.leadDays)
  }
}

@CommandHandler(PlanTaskRemindersCommand)
export class PlanTaskRemindersHandler
  extends PlanningHandler
  implements ICommandHandler<PlanTaskRemindersCommand, Reminder[]>
{
  constructor(
    @Inject(TASKS) private readonly tasks: TaskRepository,
    private readonly due: DueCalculator,
    @Inject(REMINDERS) reminders: ReminderRepository,
    @Inject(REMINDER_QUEUE) queue: ReminderQueue,
    @Inject(ID_GENERATOR) ids: IdGenerator,
    @Inject(CLOCK) clock: Clock,
    @Inject(UPKEEP_SETTINGS) settings: UpkeepSettings,
  ) {
    super(reminders, queue, ids, clock, settings)
  }

  async execute({ taskId }: PlanTaskRemindersCommand): Promise<Reminder[]> {
    const task = await this.tasks.find(taskId)
    if (!task) throw new NotFoundError('Task', taskId)
    const due = await this.due.dueOf(task)
    const subject = due && {
      subjectType: 'TASK' as const,
      subjectId: task.id,
      assetId: task.assetId,
      title: task.title,
      dueAt: due.dueAt,
    }
    return this.planner.replan(subject, task.id)
  }
}

@CommandHandler(PlanRenewalRemindersCommand)
export class PlanRenewalRemindersHandler
  extends PlanningHandler
  implements ICommandHandler<PlanRenewalRemindersCommand, Reminder[]>
{
  constructor(
    @Inject(RENEWALS) private readonly renewals: RenewalRepository,
    @Inject(REMINDERS) reminders: ReminderRepository,
    @Inject(REMINDER_QUEUE) queue: ReminderQueue,
    @Inject(ID_GENERATOR) ids: IdGenerator,
    @Inject(CLOCK) clock: Clock,
    @Inject(UPKEEP_SETTINGS) settings: UpkeepSettings,
  ) {
    super(reminders, queue, ids, clock, settings)
  }

  async execute({ renewalId }: PlanRenewalRemindersCommand): Promise<Reminder[]> {
    const renewal = await this.renewals.find(renewalId)
    if (!renewal) throw new NotFoundError('Renewal', renewalId)
    const subject: DueSubject = {
      subjectType: 'RENEWAL',
      subjectId: renewal.id,
      assetId: renewal.assetId,
      title: renewal.title,
      dueAt: renewal.expiresAt,
    }
    return this.planner.replan(subject, renewal.id)
  }
}

/** A new reading moves km-based due dates: replan every task of the asset that has a km side. */
@CommandHandler(ReplanAssetCommand)
export class ReplanAssetHandler implements ICommandHandler<ReplanAssetCommand, number> {
  constructor(
    @Inject(TASKS) private readonly tasks: TaskRepository,
    private readonly planTask: PlanTaskRemindersHandler,
  ) {}

  async execute({ assetId }: ReplanAssetCommand): Promise<number> {
    const kmTasks = (await this.tasks.listByAssets([assetId])).filter((t) => t.rule.everyKm !== null)
    for (const task of kmTasks) await this.planTask.execute(new PlanTaskRemindersCommand(task.id))
    return kmTasks.length
  }
}

@CommandHandler(SnoozeReminderCommand)
export class SnoozeReminderHandler implements ICommandHandler<SnoozeReminderCommand, Reminder> {
  constructor(
    @Inject(REMINDERS) private readonly reminders: ReminderRepository,
    @Inject(REMINDER_QUEUE) private readonly queue: ReminderQueue,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ reminderId, hours }: SnoozeReminderCommand): Promise<Reminder> {
    const current = await this.reminders.find(reminderId)
    if (!current) throw new NotFoundError('Reminder', reminderId)
    const now = this.clock.now()
    const later: Reminder = {
      ...current,
      id: this.ids.next(),
      fireAt: snoozeUntil(now, hours),
      status: 'SCHEDULED',
    }
    await this.reminders.setStatus(current.id, 'SNOOZED')
    await this.queue.cancel([current.id])
    await this.reminders.add(later)
    await this.queue.schedule(later.id, delayUntil(later.fireAt, now))
    return later
  }
}

function messageFor(reminder: Reminder, now: Date): string {
  const what = reminder.subjectType === 'RENEWAL' ? 'expires' : 'is due'
  if (reminder.dueAt <= now) return `${reminder.title} ${what} now`
  const days = Math.max(1, Math.round((reminder.dueAt.getTime() - now.getTime()) / 86_400_000))
  return `${reminder.title} ${what} in ${days} day${days === 1 ? '' : 's'}`
}

/**
 * Runs in the worker. Idempotent: only a SCHEDULED reminder fires, and the notification row is unique per
 * reminder, so a redelivered job is a no-op. Fan-out and mail happen after the commit and never fail the job.
 */
@CommandHandler(FireReminderCommand)
export class FireReminderHandler implements ICommandHandler<FireReminderCommand, Notification | null> {
  private readonly logger = new Logger(FireReminderHandler.name)

  constructor(
    @Inject(REMINDERS) private readonly reminders: ReminderRepository,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationRepository,
    @Inject(NOTIFICATION_BUS) private readonly bus: NotificationBus,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async execute({ reminderId }: FireReminderCommand): Promise<Notification | null> {
    const reminder = await this.reminders.find(reminderId)
    if (!reminder) throw new ReminderNotVisibleError(reminderId)
    if (reminder.status !== 'SCHEDULED') return null
    const now = this.clock.now()
    const notification: Notification = {
      id: this.ids.next(),
      reminderId,
      assetId: reminder.assetId,
      title: reminder.title,
      message: messageFor(reminder, now),
      createdAt: now,
      readAt: null,
    }
    if (!(await this.notifications.recordFired(notification))) return null
    this.events.publish(new ReminderFired(notification))
    await Promise.all([
      this.bus.publish(notification).catch((e: Error) => this.logger.warn(`fan-out failed: ${e.message}`)),
      this.mailer.send(notification).catch((e: Error) => this.logger.warn(`mail failed: ${e.message}`)),
    ])
    return notification
  }
}

/** Safety net run by a repeatable job: a SCHEDULED reminder that is past due but never fired gets re-enqueued. */
@CommandHandler(SweepRemindersCommand)
export class SweepRemindersHandler implements ICommandHandler<SweepRemindersCommand, number> {
  constructor(
    @Inject(REMINDERS) private readonly reminders: ReminderRepository,
    @Inject(REMINDER_QUEUE) private readonly queue: ReminderQueue,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const stuck = await this.reminders.listOverdueScheduled(this.clock.now(), 60_000)
    for (const reminder of stuck) await this.queue.schedule(reminder.id, 0)
    return stuck.length
  }
}

@CommandHandler(MarkNotificationReadCommand)
export class MarkNotificationReadHandler implements ICommandHandler<
  MarkNotificationReadCommand,
  Notification
> {
  constructor(
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ notificationId }: MarkNotificationReadCommand): Promise<Notification> {
    const updated = await this.notifications.markRead(notificationId, this.clock.now())
    if (!updated) throw new NotFoundError('Notification', notificationId)
    return updated
  }
}
