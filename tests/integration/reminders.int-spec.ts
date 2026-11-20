import { Logger, type INestApplication, type INestApplicationContext } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import { Queue } from 'bullmq'
import { createClient, type Client } from 'graphql-ws'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import request from 'supertest'
import WebSocket from 'ws'
import { ApiModule } from '../../apps/api/src/api.module'
import { loadConfig, type UpkeepConfig } from '../../apps/api/src/config'
import { redisConnection, REMINDER_QUEUE_NAME } from '../../apps/api/src/infrastructure/queue/reminder-queue'
import { WorkerModule, WorkerRunner } from '../../apps/api/src/worker.module'

jest.setTimeout(240_000)

interface Gql<T> {
  data?: T
  errors?: { message: string; extensions?: { code?: string } }[]
}

async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean, attempts = 80): Promise<T> {
  let value = await read()
  for (let i = 0; i < attempts && !done(value); i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    value = await read()
  }
  if (!done(value)) throw new Error(`condition not met in time; last value: ${JSON.stringify(value)}`)
  return value
}

/**
 * The whole reminder pipeline against real Postgres and Redis (Testcontainers), with the API and a worker running
 * in this process: GraphQL mutation -> saga -> delayed BullMQ job with the right delay -> worker fires ->
 * notification stored -> Redis fan-out -> graphql-ws subscription receives it. Plus retries into the dead-letter queue.
 */
describe('Upkeep reminders (Postgres + Redis)', () => {
  let postgres: StartedPostgreSqlContainer
  let redis: StartedRedisContainer
  let config: UpkeepConfig
  let api: INestApplication
  let worker: INestApplicationContext
  let ws: Client
  let probe: Queue

  const gql = async <T>(query: string, variables: Record<string, unknown> = {}): Promise<Gql<T>> => {
    const res = await request(api.getHttpServer()).post('/graphql').send({ query, variables }).expect(200)
    return res.body as Gql<T>
  }

  beforeAll(async () => {
    Logger.overrideLogger(['error'])
    ;[postgres, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:17-alpine').start(),
      new RedisContainer('redis:7-alpine').start(),
    ])
    config = {
      ...loadConfig({
        DATABASE_URL: postgres.getConnectionUri(),
        REDIS_URL: redis.getConnectionUrl(),
        REMINDER_ATTEMPTS: '3',
        REMINDER_BACKOFF_MS: '50',
      }),
      queuePrefix: `test-${randomUUID().slice(0, 8)}`,
    }
    const apiModule = await Test.createTestingModule({ imports: [ApiModule.register(config)] }).compile()
    api = apiModule.createNestApplication()
    await api.listen(0, '127.0.0.1')
    const workerModule = await Test.createTestingModule({
      imports: [WorkerModule.register(config)],
    }).compile()
    worker = await workerModule.init()
    const { port } = api.getHttpServer().address() as AddressInfo
    ws = createClient({ url: `ws://127.0.0.1:${port}/graphql`, webSocketImpl: WebSocket, lazy: false })
    probe = new Queue(REMINDER_QUEUE_NAME, {
      connection: redisConnection(config.redisUrl),
      prefix: config.queuePrefix,
    })
  })

  afterAll(async () => {
    await ws?.dispose()
    await probe?.close()
    await worker?.close()
    await api?.close()
    await Promise.all([postgres?.stop(), redis?.stop()])
  })

  async function registerCar(name: string): Promise<string> {
    const res = await gql<{ registerAsset: { id: string } }>(
      `mutation($input: RegisterAssetInput!) { registerAsset(input: $input) { id } }`,
      { input: { kind: 'CAR', name } },
    )
    return res.data!.registerAsset.id
  }

  it('schedules a delayed job with the right delay, fires it, stores it and pushes it to subscribers', async () => {
    const received: { notificationAdded: { title: string; message: string } }[] = []
    const subscribed = new Promise<void>((resolve, reject) => {
      ws.subscribe(
        { query: 'subscription { notificationAdded { title message } }' },
        {
          next: (msg) => {
            received.push(msg.data as (typeof received)[number])
          },
          error: reject,
          complete: () => undefined,
        },
      )
      setTimeout(resolve, 500)
    })
    await subscribed

    const carId = await registerCar('Test hatchback')
    const dueAt = new Date(Date.now() + 2000)
    const added = await gql<{ addTask: { id: string } }>(
      `mutation($input: AddTaskInput!) { addTask(input: $input) { id } }`,
      {
        input: {
          assetId: carId,
          title: 'Oil change',
          everyKm: 10000,
          everyMonths: 6,
          lastDoneKm: 40000,
          dueAt,
        },
      },
    )
    const taskId = added.data!.addTask.id

    // The saga plans asynchronously: wait for the reminder row, then check its BullMQ job.
    const reminders = await eventually(
      async () =>
        (
          await gql<{
            asset: { tasks: { reminders: { id: string; leadDays: number; status: string }[] }[] }
          }>(`query($id: ID!) { asset(id: $id) { tasks { reminders { id leadDays status } } } }`, {
            id: carId,
          })
        ).data!.asset.tasks[0].reminders,
      (list) => list.length > 0,
    )
    expect(reminders).toHaveLength(1)
    expect(reminders[0].leadDays).toBe(0)
    const job = await probe.getJob(reminders[0].id)
    expect(job?.opts.delay).toBeGreaterThan(500)
    expect(job?.opts.delay).toBeLessThanOrEqual(2000)
    expect(job?.opts.attempts).toBe(3)

    const notifications = await eventually(
      async () =>
        (
          await gql<{ notifications: { title: string; reminderId: string }[] }>(
            `{ notifications { title reminderId } }`,
          )
        ).data!.notifications,
      (list) => list.some((n) => n.reminderId === reminders[0].id),
    )
    expect(notifications[0].title).toBe('Oil change')
    await eventually(
      async () => received.length,
      (n) => n > 0,
    )
    expect(received[0].notificationAdded).toEqual({ title: 'Oil change', message: 'Oil change is due now' })

    const fired = await gql<{ asset: { tasks: { id: string; reminders: { status: string }[] }[] } }>(
      `query($id: ID!) { asset(id: $id) { tasks { id reminders { status } } } }`,
      { id: carId },
    )
    expect(fired.data!.asset.tasks.find((t) => t.id === taskId)!.reminders[0].status).toBe('FIRED')
  })

  it('projects a km-based due date from readings and rejects a reading that goes backwards', async () => {
    const carId = await registerCar('Daily driver')
    const day = 86_400_000
    const now = Date.now()
    for (const [daysAgo, km] of [
      [20, 10_000],
      [10, 11_000],
    ]) {
      await gql(`mutation($input: RecordReadingInput!) { recordReading(input: $input) { id } }`, {
        input: { assetId: carId, value: km, at: new Date(now - daysAgo * day) },
      })
    }
    await gql(`mutation($input: AddTaskInput!) { addTask(input: $input) { id } }`, {
      input: { assetId: carId, title: 'Tyres', everyKm: 2000, everyMonths: 12, lastDoneKm: 10_500 },
    })
    const res = await gql<{ asset: { tasks: { due: { reason: string; dueKm: number; dueAt: string } }[] } }>(
      `query($id: ID!) { asset(id: $id) { tasks { due { reason dueKm dueAt } } } }`,
      { id: carId },
    )
    const due = res.data!.asset.tasks[0].due
    expect(due).toMatchObject({ reason: 'DISTANCE', dueKm: 12_500 })
    // 100 km/day from 11 000 km ten days ago -> 12 500 km five days from now.
    const expected = now + 5 * day
    expect(Math.abs(new Date(due.dueAt).getTime() - expected)).toBeLessThan(60_000)

    const backwards = await gql(
      `mutation($input: RecordReadingInput!) { recordReading(input: $input) { id } }`,
      {
        input: { assetId: carId, value: 10_900 },
      },
    )
    expect(backwards.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT')
  })

  it('batches relations with DataLoader and answers dueSoon across assets', async () => {
    const res = await gql<{
      dueSoon: { title: string; asset: { name: string } }[]
      assets: { tasks: unknown[] }[]
    }>(
      `{ assets { name tasks { title due { reason } } renewals { title } } dueSoon(withinDays: 400) { title asset { name } } }`,
    )
    expect(res.errors).toBeUndefined()
    expect(res.data!.assets.length).toBeGreaterThanOrEqual(2)
    expect(res.data!.dueSoon.map((d) => d.title)).toContain('Tyres')
  })

  it('retries a failing job with backoff and then moves it to the dead-letter queue', async () => {
    const missing = randomUUID()
    await probe.add(
      'fire',
      { reminderId: missing },
      { jobId: missing, attempts: 3, backoff: { type: 'fixed', delay: 50 } },
    )
    const runner = worker.get(WorkerRunner)
    const dead = await eventually(
      () => runner.worker.deadLetters.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']),
      (jobs) => jobs.some((j) => j.data.jobId === missing),
    )
    const letter = dead.find((j) => j.data.jobId === missing)!.data
    expect(letter.attemptsMade).toBe(3)
    expect(letter.failedReason).toContain('not visible')
  })
})
