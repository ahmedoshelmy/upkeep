import { Field, Float, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql'
import { ASSET_KINDS, type AssetKind } from '../../domain/asset'
import { RENEWAL_KINDS, type RenewalKind } from '../../domain/renewal'

const enumOf = <T extends string>(values: readonly T[]): Record<T, T> =>
  Object.fromEntries(values.map((v) => [v, v])) as Record<T, T>

export const AssetKindEnum = enumOf(ASSET_KINDS)
export const RenewalKindEnum = enumOf(RENEWAL_KINDS)
export const DueReasonEnum = enumOf(['TIME', 'DISTANCE', 'FIXED_DATE', 'EXPIRY'] as const)
export const ReminderStatusEnum = enumOf(['SCHEDULED', 'FIRED', 'CANCELLED', 'SNOOZED'] as const)
export const SubjectTypeEnum = enumOf(['TASK', 'RENEWAL'] as const)
export const MeterEnum = enumOf(['ODOMETER_KM', 'ELECTRICITY_KWH'] as const)

registerEnumType(AssetKindEnum, { name: 'AssetKind' })
registerEnumType(RenewalKindEnum, { name: 'RenewalKind' })
registerEnumType(DueReasonEnum, {
  name: 'DueReason',
  description: 'Which side of the rule decided the due date',
})
registerEnumType(ReminderStatusEnum, { name: 'ReminderStatus' })
registerEnumType(SubjectTypeEnum, { name: 'SubjectType' })
registerEnumType(MeterEnum, { name: 'Meter' })

@ObjectType('Asset')
export class AssetType {
  @Field(() => ID) id!: string
  @Field(() => AssetKindEnum) kind!: AssetKind
  @Field() name!: string
  @Field() createdAt!: Date
}

@ObjectType('Reminder')
export class ReminderType {
  @Field(() => ID) id!: string
  @Field(() => SubjectTypeEnum) subjectType!: string
  @Field(() => ID) subjectId!: string
  @Field() title!: string
  @Field() dueAt!: Date
  @Field() fireAt!: Date
  @Field(() => Float, { description: '0 is the reminder at the due moment itself' }) leadDays!: number
  @Field(() => ReminderStatusEnum) status!: string
}

@ObjectType('MaintenanceTask')
export class TaskType {
  @Field(() => ID) id!: string
  @Field(() => ID) assetId!: string
  @Field() title!: string
  @Field(() => Int, { nullable: true }) everyKm!: number | null
  @Field(() => Int, { nullable: true }) everyMonths!: number | null
  @Field() lastDoneAt!: Date
  @Field(() => Float, { nullable: true }) lastDoneKm!: number | null
}

@ObjectType('Renewal')
export class RenewalType {
  @Field(() => ID) id!: string
  @Field(() => ID) assetId!: string
  @Field(() => RenewalKindEnum) kind!: RenewalKind
  @Field() title!: string
  @Field() expiresAt!: Date
}

@ObjectType('Reading')
export class ReadingType {
  @Field(() => ID) id!: string
  @Field(() => MeterEnum) meter!: string
  @Field() at!: Date
  @Field(() => Float) value!: number
}

@ObjectType('Due')
export class DueType {
  @Field() dueAt!: Date
  @Field(() => Float, { nullable: true }) dueKm!: number | null
  @Field(() => DueReasonEnum) reason!: string
}

@ObjectType('DueItem')
export class DueItemType extends DueType {
  @Field(() => SubjectTypeEnum) subjectType!: string
  @Field(() => ID) subjectId!: string
  @Field(() => ID) assetId!: string
  @Field() title!: string
}

@ObjectType('ConsumptionPeriod')
export class ConsumptionPeriodType {
  @Field() from!: Date
  @Field() to!: Date
  @Field(() => Float) units!: number
  @Field(() => Float) perDay!: number
}

@ObjectType('BillLine')
export class BillLineType {
  @Field(() => Float) kwh!: number
  @Field(() => Float) pricePerKwh!: number
  @Field(() => Float) amount!: number
}

@ObjectType('BillEstimate')
export class BillEstimateType {
  @Field(() => Float) kwh!: number
  @Field(() => Int) bandIndex!: number
  @Field(() => [BillLineType]) lines!: BillLineType[]
  @Field(() => Float) fee!: number
  @Field(() => Float) total!: number
  @Field() currency!: string
}

@ObjectType('Usage')
export class UsageType {
  @Field(() => [ConsumptionPeriodType]) periods!: ConsumptionPeriodType[]
  @Field(() => Float, { nullable: true, description: 'km or kWh per day over the last 90 days' })
  perDay!: number | null
  @Field(() => BillEstimateType, { nullable: true }) monthlyBill!: BillEstimateType | null
}

@ObjectType('FuelUp')
export class FuelUpType {
  @Field(() => ID) id!: string
  @Field() at!: Date
  @Field(() => Float) odometerKm!: number
  @Field(() => Float) litres!: number
  @Field(() => Float) cost!: number
  @Field() fullTank!: boolean
}

@ObjectType('FuelEconomy', { description: 'Full-to-full: only stretches between two full tanks count' })
export class FuelEconomyType {
  @Field(() => Float) distanceKm!: number
  @Field(() => Float) litres!: number
  @Field(() => Float) cost!: number
  @Field(() => Float) litresPer100Km!: number
  @Field(() => Float) costPerKm!: number
}

@ObjectType('Notification')
export class NotificationType {
  @Field(() => ID) id!: string
  @Field(() => ID) reminderId!: string
  @Field(() => ID) assetId!: string
  @Field() title!: string
  @Field() message!: string
  @Field() createdAt!: Date
  @Field(() => Date, { nullable: true }) readAt!: Date | null
}

@InputType()
export class RegisterAssetInput {
  @Field(() => AssetKindEnum) kind!: AssetKind
  @Field() name!: string
}

@InputType()
export class AddTaskInput {
  @Field(() => ID) assetId!: string
  @Field() title!: string
  @Field(() => Int, { nullable: true }) everyKm?: number | null
  @Field(() => Int, { nullable: true }) everyMonths?: number | null
  @Field(() => Date, { nullable: true, description: 'Defaults to now' }) lastDoneAt?: Date | null
  @Field(() => Float, { nullable: true }) lastDoneKm?: number | null
  @Field(() => Date, {
    nullable: true,
    description: 'A known due date (service sticker); the earliest side wins',
  })
  dueAt?: Date | null
}

@InputType()
export class CompleteTaskInput {
  @Field(() => ID) taskId!: string
  @Field(() => Date, { nullable: true }) doneAt?: Date | null
  @Field(() => Float, { nullable: true }) doneKm?: number | null
}

@InputType()
export class RecordReadingInput {
  @Field(() => ID) assetId!: string
  @Field(() => Float) value!: number
  @Field(() => Date, { nullable: true }) at?: Date | null
}

@InputType()
export class RecordFuelUpInput {
  @Field(() => ID) assetId!: string
  @Field(() => Float, { description: 'Odometer at the pump; recorded as a reading too' }) odometerKm!: number
  @Field(() => Float) litres!: number
  @Field(() => Float) cost!: number
  @Field({ defaultValue: true }) fullTank!: boolean
  @Field(() => Date, { nullable: true }) at?: Date | null
}

@InputType()
export class AddRenewalInput {
  @Field(() => ID) assetId!: string
  @Field(() => RenewalKindEnum) kind!: RenewalKind
  @Field() title!: string
  @Field() expiresAt!: Date
}
