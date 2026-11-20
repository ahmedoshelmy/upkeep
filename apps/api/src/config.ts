import { hostname } from 'node:os'
import { DEFAULT_LEAD_DAYS } from './domain/reminder-schedule'
import type { TariffTable } from './domain/tariff'
import { DEFAULT_TARIFF } from './infrastructure/default-tariff'
import { DEFAULT_QUERY_LIMITS, type QueryLimits } from './presentation/graphql/query-limits'

export interface UpkeepConfig {
  readonly port: number
  readonly databaseUrl: string
  readonly redisUrl: string
  /** Prefix for every BullMQ key, so parallel test runs (or tenants) can share one Redis. */
  readonly queuePrefix: string
  readonly leadDays: readonly number[]
  readonly reminderAttempts: number
  readonly reminderBackoffMs: number
  /** Tries for one reminder (re)plan before the saga gives up and logs it. */
  readonly planAttempts: number
  readonly planBackoffMs: number
  readonly sweepEveryMs: number
  readonly workerConcurrency: number
  /** Recorded in each job result: which competing consumer handled it. */
  readonly workerName: string
  readonly mailSmtpUrl: string | null
  readonly mailFrom: string
  readonly mailTo: string
  readonly tariff: TariffTable
  readonly demoData: boolean
  /** GraphQL depth and cost limits, checked before any resolver runs. */
  readonly queryLimits: QueryLimits
}

export const UPKEEP_CONFIG = Symbol('UpkeepConfig')

function positiveInt(value: string | undefined, fallback: number): number {
  const n = value === undefined || value === '' ? fallback : Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Expected a positive integer, got "${value}"`)
  return n
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function leadDays(value: string | undefined): readonly number[] {
  if (!value) return DEFAULT_LEAD_DAYS
  const days = value.split(',').map((d) => Number(d.trim()))
  if (days.some((d) => !Number.isFinite(d) || d <= 0))
    throw new Error(`LEAD_DAYS must be positive numbers: "${value}"`)
  return days
}

/** Validated once at start-up so a misconfigured container fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): UpkeepConfig {
  return {
    port: positiveInt(env.PORT, 3000),
    databaseUrl: required(env, 'DATABASE_URL'),
    redisUrl: required(env, 'REDIS_URL'),
    queuePrefix: env.QUEUE_PREFIX || 'upkeep',
    leadDays: leadDays(env.LEAD_DAYS),
    reminderAttempts: positiveInt(env.REMINDER_ATTEMPTS, 5),
    reminderBackoffMs: positiveInt(env.REMINDER_BACKOFF_MS, 5000),
    planAttempts: positiveInt(env.PLAN_ATTEMPTS, 4),
    planBackoffMs: positiveInt(env.PLAN_BACKOFF_MS, 500),
    sweepEveryMs: positiveInt(env.SWEEP_EVERY_MS, 15 * 60_000),
    workerConcurrency: positiveInt(env.WORKER_CONCURRENCY, 4),
    workerName: env.WORKER_NAME || hostname(),
    mailSmtpUrl: env.MAIL_SMTP_URL || null,
    mailFrom: env.MAIL_FROM || 'upkeep@example.com',
    mailTo: env.MAIL_TO || 'owner@example.com',
    tariff: env.TARIFF_JSON ? (JSON.parse(env.TARIFF_JSON) as TariffTable) : DEFAULT_TARIFF,
    demoData: env.DEMO_DATA === 'true',
    queryLimits: {
      maxDepth: positiveInt(env.GRAPHQL_MAX_DEPTH, DEFAULT_QUERY_LIMITS.maxDepth),
      maxCost: positiveInt(env.GRAPHQL_MAX_COST, DEFAULT_QUERY_LIMITS.maxCost),
      listFactor: DEFAULT_QUERY_LIMITS.listFactor,
    },
  }
}
