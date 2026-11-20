import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, type ICommandHandler } from '@nestjs/cqrs'
import { type Asset, createAsset, meterOf } from '../domain/asset'
import { ensure } from '../domain/errors'
import { intervalRule } from '../domain/interval-rule'
import { type MaintenanceTask, completeTask, createTask } from '../domain/maintenance-task'
import { type FuelUp, assertValidFuelUp } from '../domain/fuel'
import { assertMonotonic } from '../domain/readings'
import { type Renewal, createRenewal, renew } from '../domain/renewal'
import {
  AddRenewalCommand,
  AddTaskCommand,
  CompleteTaskCommand,
  RecordFuelUpCommand,
  RecordReadingCommand,
  RegisterAssetCommand,
  RenewCommand,
} from './commands'
import { NotFoundError } from './errors'
import { ReadingRecorded, RenewalDueChanged, TaskDueChanged } from './events'
import {
  ASSETS,
  type AssetRepository,
  CLOCK,
  type Clock,
  FUEL_UPS,
  type FuelUpRepository,
  ID_GENERATOR,
  type IdGenerator,
  READINGS,
  RENEWALS,
  type ReadingRepository,
  type RenewalRepository,
  TASKS,
  type TaskRepository,
} from './ports'
import type { StoredReading } from './records'

async function requireAsset(assets: AssetRepository, id: string): Promise<Asset> {
  const asset = await assets.find(id)
  if (!asset) throw new NotFoundError('Asset', id)
  return asset
}

@CommandHandler(RegisterAssetCommand)
export class RegisterAssetHandler implements ICommandHandler<RegisterAssetCommand, Asset> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ kind, name }: RegisterAssetCommand): Promise<Asset> {
    const asset = createAsset(this.ids.next(), kind, name, this.clock.now())
    await this.assets.save(asset)
    return asset
  }
}

@CommandHandler(AddTaskCommand)
export class AddTaskHandler implements ICommandHandler<AddTaskCommand, MaintenanceTask> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(TASKS) private readonly tasks: TaskRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async execute({ input }: AddTaskCommand): Promise<MaintenanceTask> {
    await requireAsset(this.assets, input.assetId)
    const task = createTask({
      id: this.ids.next(),
      assetId: input.assetId,
      title: input.title,
      rule: intervalRule(input.everyKm, input.everyMonths),
      baseline: { doneAt: input.lastDoneAt ?? this.clock.now(), doneKm: input.lastDoneKm },
      fixedDueAt: input.dueAt,
    })
    await this.tasks.save(task)
    this.events.publish(new TaskDueChanged(task.id))
    return task
  }
}

@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand, MaintenanceTask> {
  constructor(
    @Inject(TASKS) private readonly tasks: TaskRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async execute({ taskId, doneAt, doneKm }: CompleteTaskCommand): Promise<MaintenanceTask> {
    const task = await this.tasks.find(taskId)
    if (!task) throw new NotFoundError('Task', taskId)
    const done = completeTask(task, doneAt ?? this.clock.now(), doneKm)
    await this.tasks.save(done)
    this.events.publish(new TaskDueChanged(done.id))
    return done
  }
}

@CommandHandler(RecordReadingCommand)
export class RecordReadingHandler implements ICommandHandler<RecordReadingCommand, StoredReading> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(READINGS) private readonly readings: ReadingRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async execute({ assetId, value, at }: RecordReadingCommand): Promise<StoredReading> {
    const asset = await requireAsset(this.assets, assetId)
    const meter = meterOf(asset.kind)
    ensure(meter !== null, `A ${asset.kind.toLowerCase()} has no meter to read`)
    const reading: StoredReading = { id: this.ids.next(), assetId, meter, at: at ?? this.clock.now(), value }
    assertMonotonic(await this.readings.listByAssets([assetId]), reading)
    await this.readings.add(reading)
    this.events.publish(new ReadingRecorded(assetId))
    return reading
  }
}

@CommandHandler(RecordFuelUpCommand)
export class RecordFuelUpHandler implements ICommandHandler<RecordFuelUpCommand, FuelUp> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(READINGS) private readonly readings: ReadingRepository,
    @Inject(FUEL_UPS) private readonly fuelUps: FuelUpRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async execute({ input }: RecordFuelUpCommand): Promise<FuelUp> {
    const asset = await requireAsset(this.assets, input.assetId)
    ensure(asset.kind === 'CAR', 'Only a car takes fuel')
    assertValidFuelUp(input.litres, input.cost)
    const at = input.at ?? this.clock.now()
    const reading: StoredReading = {
      id: this.ids.next(),
      assetId: asset.id,
      meter: 'ODOMETER_KM',
      at,
      value: input.odometerKm,
    }
    assertMonotonic(await this.readings.listByAssets([asset.id]), reading)
    const fuelUp: FuelUp = { id: this.ids.next(), ...input, at }
    await this.fuelUps.addWithReading(fuelUp, reading)
    this.events.publish(new ReadingRecorded(asset.id))
    return fuelUp
  }
}

@CommandHandler(AddRenewalCommand)
export class AddRenewalHandler implements ICommandHandler<AddRenewalCommand, Renewal> {
  constructor(
    @Inject(ASSETS) private readonly assets: AssetRepository,
    @Inject(RENEWALS) private readonly renewals: RenewalRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: EventBus,
  ) {}

  async execute({ assetId, kind, title, expiresAt }: AddRenewalCommand): Promise<Renewal> {
    await requireAsset(this.assets, assetId)
    const renewal = createRenewal({ id: this.ids.next(), assetId, kind, title, expiresAt })
    await this.renewals.save(renewal)
    this.events.publish(new RenewalDueChanged(renewal.id))
    return renewal
  }
}

@CommandHandler(RenewCommand)
export class RenewHandler implements ICommandHandler<RenewCommand, Renewal> {
  constructor(
    @Inject(RENEWALS) private readonly renewals: RenewalRepository,
    private readonly events: EventBus,
  ) {}

  async execute({ renewalId, expiresAt }: RenewCommand): Promise<Renewal> {
    const current = await this.renewals.find(renewalId)
    if (!current) throw new NotFoundError('Renewal', renewalId)
    const renewed = renew(current, expiresAt)
    await this.renewals.save(renewed)
    this.events.publish(new RenewalDueChanged(renewed.id))
    return renewed
  }
}
