import { DomainError } from './errors'
import { type FuelUp, assertValidFuelUp, fuelEconomy } from './fuel'

let n = 0
const fill = (odometerKm: number, litres: number, cost: number, fullTank = true): FuelUp => ({
  id: `f${++n}`,
  assetId: 'car',
  at: new Date(Date.UTC(2026, 0, 1) + odometerKm * 60_000),
  odometerKm,
  litres,
  cost,
  fullTank,
})

describe('fuelEconomy (full-to-full)', () => {
  it('needs one complete stretch between two full tanks', () => {
    expect(fuelEconomy([])).toBeNull()
    expect(fuelEconomy([fill(10_000, 40, 600)])).toBeNull()
    expect(fuelEconomy([fill(10_000, 40, 600, false), fill(10_400, 30, 450, false)])).toBeNull()
  })

  it('ignores the first full tank and charges the next fill to the distance between them', () => {
    const economy = fuelEconomy([fill(10_000, 40, 600), fill(10_500, 35, 525)])
    expect(economy).toMatchObject({ distanceKm: 500, litres: 35, cost: 525 })
    expect(economy?.litresPer100Km).toBeCloseTo(7)
    expect(economy?.costPerKm).toBeCloseTo(1.05)
  })

  it('counts partial fill-ups inside a stretch and leaves an open stretch out', () => {
    const economy = fuelEconomy([
      fill(20_000, 45, 700),
      fill(20_300, 10, 150, false),
      fill(20_800, 30, 450),
      fill(21_000, 15, 230, false), // after the last full tank: waits for the next one
    ])
    expect(economy?.distanceKm).toBe(800)
    expect(economy?.litres).toBe(40)
    expect(economy?.cost).toBe(600)
    expect(economy?.litresPer100Km).toBeCloseTo(5)
    expect(economy?.costPerKm).toBeCloseTo(0.75)
  })

  it('orders by odometer, not by the order of entry', () => {
    const economy = fuelEconomy([fill(30_600, 42, 630), fill(30_000, 40, 600)])
    expect(economy?.distanceKm).toBe(600)
    expect(economy?.litresPer100Km).toBeCloseTo(7)
  })

  it('rejects impossible amounts', () => {
    expect(() => assertValidFuelUp(0, 100)).toThrow(DomainError)
    expect(() => assertValidFuelUp(500, 100)).toThrow(DomainError)
    expect(() => assertValidFuelUp(30, -1)).toThrow(DomainError)
    expect(() => assertValidFuelUp(30, 450)).not.toThrow()
  })
})
