import { EventBus } from '@nestjs/cqrs'
import { intervalRule } from '../domain/interval-rule'
import { MS_PER_DAY } from '../domain/time'
import {
  FireReminderCommand,
  PlanTaskRemindersCommand,
  ReplanAssetCommand,
  SnoozeReminderCommand,
} from './commands'
import { DueCalculator } from './due-calculator'
import { ReminderNotVisibleError } from './errors'
import {
  FailingMailer,
  FakeClock,
  MemoryNotifications,
  MemoryReadings,
  MemoryReminders,
  MemoryTasks,
  RecordingBus,
  RecordingQueue,
  SequentialIds,
} from './in-memory.spec-util'
import {
  FireReminderHandler,
  PlanTaskRemindersHandler,
  ReplanAssetHandler,
  SnoozeReminderHandler,
  SweepRemindersHandler,
} from './reminder-handlers'

const start = new Date('2026-03-01T08:00:00Z')

function setup() {
  const clock = new FakeClock(start)
  const ids = new SequentialIds()
  const tasks = new MemoryTasks()
  const readings = new MemoryReadings()
  const reminders = new MemoryReminders()
  const notifications = new MemoryNotifications(reminders)
  const queue = new RecordingQueue()
  const bus = new RecordingBus()
  const mailer = new FailingMailer()
  const events = { publish: jest.fn() } as unknown as EventBus
  const settings = {
    leadDays: [30, 7, 1],
    tariff: { currency: 'EGP', bands: [] },
    planRetry: { attempts: 3, baseDelayMs: 100 },
  }
  const plan = new PlanTaskRemindersHandler(
    tasks,
    new DueCalculator(readings),
    reminders,
    queue,
    ids,
    clock,
    settings,
  )
  const fire = new FireReminderHandler(reminders, notifications, bus, mailer, ids, clock, events)
  return { clock, tasks, readings, reminders, notifications, queue, bus, mailer, events, ids, plan, fire }
}

describe('reminder handlers', () => {
  it('plans 30/7/1/0-day reminders with delays measured from now', async () => {
    const s = setup()
    await s.tasks.save({
      id: 'task',
      assetId: 'car',
      title: 'Oil change',
      rule: intervalRule(null, 3),
      baseline: { doneAt: start, doneKm: null },
      fixedDueAt: null,
    })
    const plan = await s.plan.execute(new PlanTaskRemindersCommand('task'))
    expect(plan.map((r) => r.leadDays)).toEqual([30, 7, 1, 0])
    const dueIn = new Date('2026-06-01T08:00:00Z').getTime() - start.getTime()
    expect(s.queue.scheduled.map((j) => j.delayMs)).toEqual([
      dueIn - 30 * MS_PER_DAY,
      dueIn - 7 * MS_PER_DAY,
      dueIn - MS_PER_DAY,
      dueIn,
    ])
  })

  it('replanning cancels the pending reminders and their jobs', async () => {
    const s = setup()
    await s.tasks.save({
      id: 'task',
      assetId: 'car',
      title: 'Oil change',
      rule: intervalRule(5000, 6),
      baseline: { doneAt: start, doneKm: 1000 },
      fixedDueAt: null,
    })
    const first = await s.plan.execute(new PlanTaskRemindersCommand('task'))
    const replan = new ReplanAssetHandler(s.tasks, s.plan)
    expect(await replan.execute(new ReplanAssetCommand('car'))).toBe(1)
    expect(s.queue.cancelled).toEqual(first.map((r) => r.id))
    const statuses = [...s.reminders.rows.values()].map((r) => r.status)
    expect(statuses.filter((x) => x === 'CANCELLED')).toHaveLength(first.length)
  })

  it('retries a plan whose enqueue failed, cancelling the half-stored try first', async () => {
    const s = setup()
    await s.tasks.save({
      id: 'task',
      assetId: 'car',
      title: 'Oil change',
      rule: intervalRule(null, 3),
      baseline: { doneAt: start, doneKm: null },
      fixedDueAt: null,
    })
    s.queue.failNextSchedules = 2
    const plan = await s.plan.execute(new PlanTaskRemindersCommand('task'))
    expect(s.clock.slept).toEqual([100, 200])
    expect(s.queue.scheduled.map((j) => j.reminderId)).toEqual(plan.map((r) => r.id))
    const live = [...s.reminders.rows.values()].filter((r) => r.status === 'SCHEDULED')
    expect(live.map((r) => r.id)).toEqual(plan.map((r) => r.id))
    expect(s.queue.cancelled).toHaveLength(8)
  })

  it('gives up after the last try and rethrows', async () => {
    const s = setup()
    await s.tasks.save({
      id: 'task',
      assetId: 'car',
      title: 'Oil change',
      rule: intervalRule(null, 3),
      baseline: { doneAt: start, doneKm: null },
      fixedDueAt: null,
    })
    s.queue.failNextSchedules = 3
    await expect(s.plan.execute(new PlanTaskRemindersCommand('task'))).rejects.toThrow('redis unavailable')
  })

  it('fires once: a redelivered job is a no-op, and a mail failure does not fail the job', async () => {
    const s = setup()
    await s.reminders.add({
      id: 'r1',
      subjectType: 'RENEWAL',
      subjectId: 'ren',
      assetId: 'car',
      title: 'Car licence',
      dueAt: new Date(start.getTime() + 7 * MS_PER_DAY),
      fireAt: start,
      leadDays: 7,
      status: 'SCHEDULED',
    })
    const first = await s.fire.execute(new FireReminderCommand('r1'))
    expect(first?.message).toBe('Car licence expires in 7 days')
    expect(await s.fire.execute(new FireReminderCommand('r1'))).toBeNull()
    expect(s.notifications.rows).toHaveLength(1)
    expect(s.bus.published).toHaveLength(1)
    expect(s.mailer.attempts).toBe(1)
    expect((await s.reminders.find('r1'))?.status).toBe('FIRED')
  })

  it('throws a retryable error for a reminder it cannot see yet', async () => {
    await expect(setup().fire.execute(new FireReminderCommand('nope'))).rejects.toBeInstanceOf(
      ReminderNotVisibleError,
    )
  })

  it('snoozes: the old reminder is SNOOZED, a new one fires later', async () => {
    const s = setup()
    await s.reminders.add({
      id: 'r1',
      subjectType: 'TASK',
      subjectId: 'task',
      assetId: 'car',
      title: 'Oil change',
      dueAt: start,
      fireAt: start,
      leadDays: 0,
      status: 'SCHEDULED',
    })
    const snooze = new SnoozeReminderHandler(s.reminders, s.queue, s.ids, s.clock)
    const later = await snooze.execute(new SnoozeReminderCommand('r1', 48))
    expect((await s.reminders.find('r1'))?.status).toBe('SNOOZED')
    expect(later.fireAt).toEqual(new Date('2026-03-03T08:00:00Z'))
    expect(s.queue.cancelled).toEqual(['r1'])
    expect(s.queue.scheduled).toEqual([{ reminderId: later.id, delayMs: 48 * 3_600_000 }])
  })

  it('sweeps scheduled reminders that are overdue and never fired', async () => {
    const s = setup()
    await s.reminders.add({
      id: 'stuck',
      subjectType: 'TASK',
      subjectId: 'task',
      assetId: 'car',
      title: 'Oil change',
      dueAt: start,
      fireAt: new Date(start.getTime() - 3_600_000),
      leadDays: 0,
      status: 'SCHEDULED',
    })
    const sweep = new SweepRemindersHandler(s.reminders, s.queue, s.clock)
    expect(await sweep.execute()).toBe(1)
    expect(s.queue.scheduled).toEqual([{ reminderId: 'stuck', delayMs: 0 }])
  })
})
