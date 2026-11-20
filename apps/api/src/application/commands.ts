import type { AssetKind } from '../domain/asset'
import type { RenewalKind } from '../domain/renewal'

export class RegisterAssetCommand {
  constructor(
    readonly kind: AssetKind,
    readonly name: string,
  ) {}
}

export interface AddTaskInput {
  readonly assetId: string
  readonly title: string
  readonly everyKm: number | null
  readonly everyMonths: number | null
  readonly lastDoneAt: Date | null
  readonly lastDoneKm: number | null
  readonly dueAt: Date | null
}

export class AddTaskCommand {
  constructor(readonly input: AddTaskInput) {}
}

export class CompleteTaskCommand {
  constructor(
    readonly taskId: string,
    readonly doneAt: Date | null,
    readonly doneKm: number | null,
  ) {}
}

export class RecordReadingCommand {
  constructor(
    readonly assetId: string,
    readonly value: number,
    readonly at: Date | null,
  ) {}
}

export interface FuelUpInput {
  readonly assetId: string
  readonly odometerKm: number
  readonly litres: number
  readonly cost: number
  readonly fullTank: boolean
  readonly at: Date | null
}

/** A fuel-up is also an odometer reading, so it moves km-based due dates like any reading. */
export class RecordFuelUpCommand {
  constructor(readonly input: FuelUpInput) {}
}

export class AddRenewalCommand {
  constructor(
    readonly assetId: string,
    readonly kind: RenewalKind,
    readonly title: string,
    readonly expiresAt: Date,
  ) {}
}

export class RenewCommand {
  constructor(
    readonly renewalId: string,
    readonly expiresAt: Date,
  ) {}
}

export class SnoozeReminderCommand {
  constructor(
    readonly reminderId: string,
    readonly hours: number,
  ) {}
}

export class MarkNotificationReadCommand {
  constructor(readonly notificationId: string) {}
}

/** Issued by the reminder saga, never by clients. */
export class PlanTaskRemindersCommand {
  constructor(readonly taskId: string) {}
}

export class PlanRenewalRemindersCommand {
  constructor(readonly renewalId: string) {}
}

export class ReplanAssetCommand {
  constructor(readonly assetId: string) {}
}

/** Executed by the worker when a delayed reminder job comes due. */
export class FireReminderCommand {
  constructor(readonly reminderId: string) {}
}

export class SweepRemindersCommand {}
