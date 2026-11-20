import { Inject } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import {
  Args,
  Context,
  Float,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql'
import type { Asset } from '../../domain/asset'
import { type FuelEconomy, type FuelUp, fuelEconomy } from '../../domain/fuel'
import type { MaintenanceTask } from '../../domain/maintenance-task'
import type { Renewal } from '../../domain/renewal'
import {
  AddRenewalCommand,
  AddTaskCommand,
  CompleteTaskCommand,
  MarkNotificationReadCommand,
  RecordFuelUpCommand,
  RecordReadingCommand,
  RegisterAssetCommand,
  RenewCommand,
  SnoozeReminderCommand,
} from '../../application/commands'
import { dueOf } from '../../application/due-calculator'
import {
  DueSoonQuery,
  GetAssetQuery,
  ListAssetsQuery,
  ListNotificationsQuery,
  type UsageReport,
  UsageQuery,
} from '../../application/queries'
import type { DueItem, Notification, Reminder, StoredReading } from '../../application/records'
import { LiveNotifications, NOTIFICATION_ADDED } from './live-notifications'
import { LoaderFactory } from './loaders'
import {
  AddRenewalInput,
  AddTaskInput,
  AssetType,
  CompleteTaskInput,
  DueItemType,
  DueType,
  FuelEconomyType,
  FuelUpType,
  NotificationType,
  ReadingType,
  RecordFuelUpInput,
  RecordReadingInput,
  RegisterAssetInput,
  ReminderType,
  RenewalType,
  TaskType,
  UsageType,
} from './types'

type Ctx = object

@Resolver(() => AssetType)
export class AssetResolver {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly loaders: LoaderFactory,
  ) {}

  @Query(() => [AssetType])
  assets(): Promise<Asset[]> {
    return this.queries.execute(new ListAssetsQuery())
  }

  @Query(() => AssetType, { nullable: true })
  asset(@Args('id', { type: () => ID }) id: string): Promise<Asset | null> {
    return this.queries.execute(new GetAssetQuery(id))
  }

  @Mutation(() => AssetType)
  registerAsset(@Args('input') input: RegisterAssetInput): Promise<Asset> {
    return this.commands.execute(new RegisterAssetCommand(input.kind, input.name))
  }

  @ResolveField(() => [TaskType])
  tasks(@Parent() asset: Asset, @Context() ctx: Ctx): Promise<MaintenanceTask[]> {
    return this.loaders.for(ctx).tasksByAsset.load(asset.id)
  }

  @ResolveField(() => [RenewalType])
  renewals(@Parent() asset: Asset, @Context() ctx: Ctx): Promise<Renewal[]> {
    return this.loaders.for(ctx).renewalsByAsset.load(asset.id)
  }

  @ResolveField(() => [ReadingType])
  readings(@Parent() asset: Asset, @Context() ctx: Ctx): Promise<StoredReading[]> {
    return this.loaders.for(ctx).readingsByAsset.load(asset.id)
  }

  @ResolveField(() => UsageType)
  usage(@Parent() asset: Asset): Promise<UsageReport> {
    return this.queries.execute(new UsageQuery(asset.id))
  }

  @ResolveField(() => [FuelUpType], { description: 'Lowest odometer first' })
  fuelUps(@Parent() asset: Asset, @Context() ctx: Ctx): Promise<FuelUp[]> {
    return this.loaders.for(ctx).fuelUpsByAsset.load(asset.id)
  }

  @ResolveField(() => FuelEconomyType, { nullable: true, description: 'Null until two full tanks' })
  async fuelEconomy(@Parent() asset: Asset, @Context() ctx: Ctx): Promise<FuelEconomy | null> {
    return fuelEconomy(await this.loaders.for(ctx).fuelUpsByAsset.load(asset.id))
  }

  @Mutation(() => FuelUpType, {
    description: 'Also records the odometer reading, so km-based due dates move',
  })
  recordFuelUp(@Args('input') input: RecordFuelUpInput): Promise<FuelUp> {
    return this.commands.execute(new RecordFuelUpCommand({ ...input, at: input.at ?? null }))
  }
}

@Resolver(() => TaskType)
export class TaskResolver {
  constructor(
    private readonly commands: CommandBus,
    private readonly loaders: LoaderFactory,
  ) {}

  @Mutation(() => TaskType, { description: 'Reminders are planned asynchronously by the reminder saga' })
  addTask(@Args('input') input: AddTaskInput): Promise<MaintenanceTask> {
    return this.commands.execute(
      new AddTaskCommand({
        assetId: input.assetId,
        title: input.title,
        everyKm: input.everyKm ?? null,
        everyMonths: input.everyMonths ?? null,
        lastDoneAt: input.lastDoneAt ?? null,
        lastDoneKm: input.lastDoneKm ?? null,
        dueAt: input.dueAt ?? null,
      }),
    )
  }

  @Mutation(() => TaskType, { description: 'Done: the baseline resets and the next due date is planned' })
  completeTask(@Args('input') input: CompleteTaskInput): Promise<MaintenanceTask> {
    return this.commands.execute(
      new CompleteTaskCommand(input.taskId, input.doneAt ?? null, input.doneKm ?? null),
    )
  }

  @ResolveField(() => Int, { nullable: true })
  everyKm(@Parent() task: MaintenanceTask): number | null {
    return task.rule.everyKm
  }

  @ResolveField(() => Int, { nullable: true })
  everyMonths(@Parent() task: MaintenanceTask): number | null {
    return task.rule.everyMonths
  }

  @ResolveField(() => Date)
  lastDoneAt(@Parent() task: MaintenanceTask): Date {
    return task.baseline.doneAt
  }

  @ResolveField(() => Float, { nullable: true })
  lastDoneKm(@Parent() task: MaintenanceTask): number | null {
    return task.baseline.doneKm
  }

  @ResolveField(() => DueType, {
    nullable: true,
    description: 'Whichever comes first of time, distance and a fixed date',
  })
  async due(@Parent() task: MaintenanceTask, @Context() ctx: Ctx): Promise<DueType | null> {
    return dueOf(task, await this.loaders.for(ctx).readingsByAsset.load(task.assetId))
  }

  @ResolveField(() => [ReminderType])
  reminders(@Parent() task: MaintenanceTask, @Context() ctx: Ctx): Promise<Reminder[]> {
    return this.loaders.for(ctx).remindersBySubject.load(task.id)
  }
}

@Resolver(() => RenewalType)
export class RenewalResolver {
  constructor(
    private readonly commands: CommandBus,
    private readonly loaders: LoaderFactory,
  ) {}

  @Mutation(() => RenewalType)
  addRenewal(@Args('input') input: AddRenewalInput): Promise<Renewal> {
    return this.commands.execute(
      new AddRenewalCommand(input.assetId, input.kind, input.title, input.expiresAt),
    )
  }

  @Mutation(() => RenewalType)
  renew(@Args('id', { type: () => ID }) id: string, @Args('expiresAt') expiresAt: Date): Promise<Renewal> {
    return this.commands.execute(new RenewCommand(id, expiresAt))
  }

  @ResolveField(() => [ReminderType])
  reminders(@Parent() renewal: Renewal, @Context() ctx: Ctx): Promise<Reminder[]> {
    return this.loaders.for(ctx).remindersBySubject.load(renewal.id)
  }
}

@Resolver(() => DueItemType)
export class DueResolver {
  constructor(
    private readonly queries: QueryBus,
    private readonly loaders: LoaderFactory,
  ) {}

  @Query(() => [DueItemType], { description: 'Tasks and renewals due within the window, overdue first' })
  dueSoon(@Args('withinDays', { type: () => Int, defaultValue: 30 }) withinDays: number): Promise<DueItem[]> {
    return this.queries.execute(new DueSoonQuery(withinDays))
  }

  @ResolveField(() => AssetType, { nullable: true })
  asset(@Parent() item: DueItem, @Context() ctx: Ctx): Promise<Asset | null> {
    return this.loaders.for(ctx).assetById.load(item.assetId)
  }
}

@Resolver(() => ReadingType)
export class ReadingResolver {
  constructor(private readonly commands: CommandBus) {}

  @Mutation(() => ReadingType, {
    description: 'Odometer (car) or electricity meter (home); must not go backwards',
  })
  recordReading(@Args('input') input: RecordReadingInput): Promise<StoredReading> {
    return this.commands.execute(new RecordReadingCommand(input.assetId, input.value, input.at ?? null))
  }
}

@Resolver(() => NotificationType)
export class NotificationResolver {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    @Inject(LiveNotifications) private readonly live: LiveNotifications,
  ) {}

  @Query(() => [NotificationType])
  notifications(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('unreadOnly', { defaultValue: false }) unreadOnly: boolean,
  ): Promise<Notification[]> {
    return this.queries.execute(new ListNotificationsQuery(limit, unreadOnly))
  }

  @Mutation(() => NotificationType)
  markNotificationRead(@Args('id', { type: () => ID }) id: string): Promise<Notification> {
    return this.commands.execute(new MarkNotificationReadCommand(id))
  }

  @Mutation(() => ReminderType, { description: 'Push one reminder later by some hours (max 30 days)' })
  snoozeReminder(
    @Args('id', { type: () => ID }) id: string,
    @Args('hours', { type: () => Float }) hours: number,
  ): Promise<Reminder> {
    return this.commands.execute(new SnoozeReminderCommand(id, hours))
  }

  @Subscription(() => NotificationType, {
    description: 'Live reminders over graphql-ws, fanned out from the worker through Redis',
    resolve: (payload: Record<string, Notification>) => payload[NOTIFICATION_ADDED],
  })
  notificationAdded(): AsyncIterableIterator<unknown> {
    return this.live.iterator()
  }
}
