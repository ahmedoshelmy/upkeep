import type { INestApplicationContext } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import type { Asset } from '../../domain/asset'
import {
  AddRenewalCommand,
  AddTaskCommand,
  RecordFuelUpCommand,
  RecordReadingCommand,
  RegisterAssetCommand,
} from '../../application/commands'
import { ListAssetsQuery } from '../../application/queries'

const DAY = 86_400_000

/** Synthetic demo data (DEMO_DATA=true), only on an empty database. Every value is made up. */
export async function seedDemoData(app: INestApplicationContext): Promise<void> {
  const commands = app.get(CommandBus)
  const existing: Asset[] = await app.get(QueryBus).execute(new ListAssetsQuery())
  if (existing.length > 0) return
  const now = Date.now()
  const ago = (days: number): Date => new Date(now - days * DAY)

  const car: Asset = await commands.execute(new RegisterAssetCommand('CAR', 'Demo hatchback'))
  for (const [days, km] of [
    [120, 52_000],
    [60, 55_100],
    [10, 57_700],
  ] as const) {
    await commands.execute(new RecordReadingCommand(car.id, km, ago(days)))
  }
  for (const [days, km, litres, cost, fullTank] of [
    [33, 56_504, 40, 710, true],
    [24, 56_972, 20, 355, false],
    [15, 57_440, 47, 834, true],
    [6, 57_900, 32, 568, true],
  ] as const) {
    await commands.execute(
      new RecordFuelUpCommand({ assetId: car.id, odometerKm: km, litres, cost, fullTank, at: ago(days) }),
    )
  }
  const task = (
    title: string,
    everyKm: number | null,
    everyMonths: number | null,
    doneDays: number,
    doneKm: number | null,
  ) =>
    commands.execute(
      new AddTaskCommand({
        assetId: car.id,
        title,
        everyKm,
        everyMonths,
        lastDoneAt: ago(doneDays),
        lastDoneKm: doneKm,
        dueAt: null,
      }),
    )
  await task('Oil change', 10_000, 6, 150, 50_500)
  await task('Tyre rotation', 10_000, null, 100, 53_000)
  await task('Brake fluid', null, 24, 600, null)
  await commands.execute(new AddRenewalCommand(car.id, 'LICENSE', 'Car licence', new Date(now + 20 * DAY)))
  await commands.execute(
    new AddRenewalCommand(car.id, 'INSURANCE', 'Car insurance', new Date(now + 75 * DAY)),
  )

  const home: Asset = await commands.execute(new RegisterAssetCommand('HOME', 'Demo apartment'))
  for (const [days, kwh] of [
    [90, 8_000],
    [60, 8_310],
    [30, 8_640],
    [1, 8_950],
  ] as const) {
    await commands.execute(new RecordReadingCommand(home.id, kwh, ago(days)))
  }
  await commands.execute(
    new AddTaskCommand({
      assetId: home.id,
      title: 'Water filter cartridges',
      everyKm: null,
      everyMonths: 3,
      lastDoneAt: ago(80),
      lastDoneKm: null,
      dueAt: null,
    }),
  )
  const fridge: Asset = await commands.execute(new RegisterAssetCommand('APPLIANCE', 'Demo fridge'))
  await commands.execute(
    new AddRenewalCommand(fridge.id, 'WARRANTY', 'Fridge warranty', new Date(now + 200 * DAY)),
  )
}
