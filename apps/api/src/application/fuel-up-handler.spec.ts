import { EventBus } from '@nestjs/cqrs'
import { createAsset } from '../domain/asset'
import { DomainError } from '../domain/errors'
import { RecordFuelUpHandler } from './asset-handlers'
import { RecordFuelUpCommand, type FuelUpInput } from './commands'
import { ReadingRecorded } from './events'
import { FakeClock, MemoryAssets, MemoryFuelUps, MemoryReadings, SequentialIds } from './in-memory.spec-util'

const now = new Date('2026-03-01T08:00:00Z')

async function setup() {
  const assets = new MemoryAssets()
  const readings = new MemoryReadings()
  const fuelUps = new MemoryFuelUps(readings)
  const publish = jest.fn()
  await assets.save(createAsset('car', 'CAR', 'Test hatchback', now))
  await assets.save(createAsset('home', 'HOME', 'Test flat', now))
  const handler = new RecordFuelUpHandler(
    assets,
    readings,
    fuelUps,
    new SequentialIds(),
    new FakeClock(now),
    { publish } as unknown as EventBus,
  )
  return { readings, fuelUps, publish, handler }
}

const input = (over: Partial<FuelUpInput> = {}): FuelUpInput => ({
  assetId: 'car',
  odometerKm: 60_000,
  litres: 40,
  cost: 600,
  fullTank: true,
  at: null,
  ...over,
})

describe('RecordFuelUpHandler', () => {
  it('stores the fuel-up with its odometer reading and announces the reading', async () => {
    const s = await setup()
    const fuelUp = await s.handler.execute(new RecordFuelUpCommand(input()))
    expect(fuelUp).toMatchObject({ assetId: 'car', odometerKm: 60_000, litres: 40, at: now })
    expect(s.readings.rows).toEqual([
      expect.objectContaining({ assetId: 'car', meter: 'ODOMETER_KM', value: 60_000, at: now }),
    ])
    expect(s.publish).toHaveBeenCalledWith(new ReadingRecorded('car'))
  })

  it('rejects an odometer that goes backwards, and anything but a car', async () => {
    const s = await setup()
    await s.handler.execute(new RecordFuelUpCommand(input()))
    const earlierAtHigherKm = input({ odometerKm: 59_000, at: new Date('2026-03-02T08:00:00Z') })
    await expect(s.handler.execute(new RecordFuelUpCommand(earlierAtHigherKm))).rejects.toThrow(DomainError)
    await expect(s.handler.execute(new RecordFuelUpCommand(input({ assetId: 'home' })))).rejects.toThrow(
      'Only a car takes fuel',
    )
    expect(s.fuelUps.rows).toHaveLength(1)
  })
})
