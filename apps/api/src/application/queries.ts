import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { Asset } from '../domain/asset'
import { type ConsumptionPeriod, consumptionPerPeriod, projectUsage } from '../domain/readings'
import { type BillEstimate, estimateBill } from '../domain/tariff'
import { dueOf } from './due-calculator'
import {
  ASSETS,
  type AssetRepository,
  CLOCK,
  type Clock,
  NOTIFICATIONS,
  type NotificationRepository,
  READINGS,
  RENEWALS,
  type ReadingRepository,
  type RenewalRepository,
  TASKS,
  type TaskRepository,
  UPKEEP_SETTINGS,
  type UpkeepSettings,
} from './ports'
import type { DueItem, Notification } from './records'

export class ListAssetsQuery {}

export class GetAssetQuery {
  constructor(readonly assetId: string) {}
}

/** Tasks and renewals falling due within `withinDays` (overdue ones included), soonest first. */
export class DueSoonQuery {
  constructor(readonly withinDays: number) {}
}

export class ListNotificationsQuery {
  constructor(
    readonly limit: number,
    readonly unreadOnly: boolean,
  ) {}
}

export class UsageQuery {
  constructor(readonly assetId: string) {}
}

export interface UsageReport {
  readonly assetId: string
  readonly periods: ConsumptionPeriod[]
  readonly perDay: number | null
  /** Electricity only: a 30-day month at the projected rate, priced with the configured tariff. */
  readonly monthlyBill: BillEstimate | null
}

@QueryHandler(ListAssetsQuery)
export class ListAssetsHandler implements IQueryHandler<ListAssetsQuery, Asset[]> {
  constructor(@Inject(ASSETS) private readonly assets: AssetRepository) {}

  execute(): Promise<Asset[]> {
    return this.assets.list()
  }
}

@QueryHandler(GetAssetQuery)
export class GetAssetHandler implements IQueryHandler<GetAssetQuery, Asset | null> {
  constructor(@Inject(ASSETS) private readonly assets: AssetRepository) {}

  execute({ assetId }: GetAssetQuery): Promise<Asset | null> {
    return this.assets.find(assetId)
  }
}

@QueryHandler(DueSoonQuery)
export class DueSoonHandler implements IQueryHandler<DueSoonQuery, DueItem[]> {
  constructor(
    @Inject(TASKS) private readonly tasks: TaskRepository,
    @Inject(RENEWALS) private readonly renewals: RenewalRepository,
    @Inject(READINGS) private readonly readings: ReadingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ withinDays }: DueSoonQuery): Promise<DueItem[]> {
    const horizon = this.clock.now().getTime() + withinDays * 86_400_000
    const [tasks, renewals] = await Promise.all([this.tasks.listAll(), this.renewals.listAll()])
    const readings = await this.readings.listByAssets([...new Set(tasks.map((t) => t.assetId))])
    const items: DueItem[] = []
    for (const task of tasks) {
      const due = dueOf(task, readings)
      if (due)
        items.push({
          subjectType: 'TASK',
          subjectId: task.id,
          assetId: task.assetId,
          title: task.title,
          ...due,
        })
    }
    for (const r of renewals) {
      items.push({
        subjectType: 'RENEWAL',
        subjectId: r.id,
        assetId: r.assetId,
        title: r.title,
        dueAt: r.expiresAt,
        dueKm: null,
        reason: 'EXPIRY',
      })
    }
    return items
      .filter((i) => i.dueAt.getTime() <= horizon)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
  }
}

@QueryHandler(ListNotificationsQuery)
export class ListNotificationsHandler implements IQueryHandler<ListNotificationsQuery, Notification[]> {
  constructor(@Inject(NOTIFICATIONS) private readonly notifications: NotificationRepository) {}

  execute({ limit, unreadOnly }: ListNotificationsQuery): Promise<Notification[]> {
    return this.notifications.list(Math.min(Math.max(limit, 1), 100), unreadOnly)
  }
}

@QueryHandler(UsageQuery)
export class UsageHandler implements IQueryHandler<UsageQuery, UsageReport> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(READINGS) private readonly readings: ReadingRepository,
    @Inject(UPKEEP_SETTINGS) private readonly settings: UpkeepSettings,
  ) {}

  async execute({ assetId }: UsageQuery): Promise<UsageReport> {
    const [asset, stored] = await Promise.all([
      this.assets.find(assetId),
      this.readings.listByAssets([assetId]),
    ])
    const usage = projectUsage(stored)
    const monthlyBill =
      asset?.kind === 'HOME' && usage
        ? estimateBill(this.settings.tariff, Math.round(usage.perDay * 30))
        : null
    return { assetId, periods: consumptionPerPeriod(stored), perDay: usage?.perDay ?? null, monthlyBill }
  }
}
