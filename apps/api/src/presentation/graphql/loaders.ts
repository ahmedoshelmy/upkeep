import { Inject, Injectable } from '@nestjs/common'
import DataLoader from 'dataloader'
import type { Asset } from '../../domain/asset'
import type { FuelUp } from '../../domain/fuel'
import type { MaintenanceTask } from '../../domain/maintenance-task'
import type { Renewal } from '../../domain/renewal'
import {
  ASSETS,
  type AssetRepository,
  FUEL_UPS,
  type FuelUpRepository,
  READINGS,
  REMINDERS,
  RENEWALS,
  type ReadingRepository,
  type ReminderRepository,
  type RenewalRepository,
  TASKS,
  type TaskRepository,
} from '../../application/ports'
import type { Reminder, StoredReading } from '../../application/records'

function groupBy<T>(keys: readonly string[], items: readonly T[], keyOf: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>(keys.map((k) => [k, []]))
  for (const item of items) groups.get(keyOf(item))?.push(item)
  return keys.map((k) => groups.get(k) ?? [])
}

/** One set of batching loaders per GraphQL request: N assets -> 1 query per relation, not N. */
export class RequestLoaders {
  constructor(
    readonly assetById: DataLoader<string, Asset | null>,
    readonly tasksByAsset: DataLoader<string, MaintenanceTask[]>,
    readonly renewalsByAsset: DataLoader<string, Renewal[]>,
    readonly readingsByAsset: DataLoader<string, StoredReading[]>,
    readonly remindersBySubject: DataLoader<string, Reminder[]>,
    readonly fuelUpsByAsset: DataLoader<string, FuelUp[]>,
  ) {}
}

@Injectable()
export class LoaderFactory {
  private readonly perRequest = new WeakMap<object, RequestLoaders>()

  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(TASKS) private readonly tasks: TaskRepository,
    @Inject(RENEWALS) private readonly renewals: RenewalRepository,
    @Inject(READINGS) private readonly readings: ReadingRepository,
    @Inject(REMINDERS) private readonly reminders: ReminderRepository,
    @Inject(FUEL_UPS) private readonly fuelUps: FuelUpRepository,
  ) {}

  /** Loaders live as long as the GraphQL context object, i.e. one HTTP request or one subscription event. */
  for(context: object): RequestLoaders {
    let loaders = this.perRequest.get(context)
    if (!loaders) {
      loaders = this.create()
      this.perRequest.set(context, loaders)
    }
    return loaders
  }

  private create(): RequestLoaders {
    return new RequestLoaders(
      new DataLoader(async (ids) => {
        const all = await this.assets.findMany(ids)
        const byId = new Map(all.map((a) => [a.id, a]))
        return ids.map((id) => byId.get(id) ?? null)
      }),
      new DataLoader(async (ids) => groupBy(ids, await this.tasks.listByAssets(ids), (t) => t.assetId)),
      new DataLoader(async (ids) => groupBy(ids, await this.renewals.listByAssets(ids), (r) => r.assetId)),
      new DataLoader(async (ids) => groupBy(ids, await this.readings.listByAssets(ids), (r) => r.assetId)),
      new DataLoader(async (ids) =>
        groupBy(ids, await this.reminders.listBySubjects(ids), (r) => r.subjectId),
      ),
      new DataLoader(async (ids) => groupBy(ids, await this.fuelUps.listByAssets(ids), (f) => f.assetId)),
    )
  }
}
