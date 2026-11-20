import { ensure } from './errors'

/** One visit to the pump: the odometer at that moment, how much went in and what it cost. */
export interface FuelUp {
  readonly id: string
  readonly assetId: string
  readonly at: Date
  readonly odometerKm: number
  readonly litres: number
  readonly cost: number
  /** Filled to the brim: only full-to-full stretches give an honest consumption figure. */
  readonly fullTank: boolean
}

export interface FuelEconomy {
  /** Distance covered by complete full-to-full stretches. */
  readonly distanceKm: number
  readonly litres: number
  readonly cost: number
  readonly litresPer100Km: number
  readonly costPerKm: number
}

export function assertValidFuelUp(litres: number, cost: number): void {
  ensure(Number.isFinite(litres) && litres > 0 && litres <= 200, 'Litres must be between 0 and 200')
  ensure(Number.isFinite(cost) && cost >= 0, 'Cost must be zero or more')
}

/**
 * Full-to-full method: the fuel burnt between two full tanks is everything poured in after the first one up to
 * and including the second (partial fill-ups in between count). Fill-ups after the last full tank are an open
 * stretch and wait for the next full one. Null until there is at least one complete stretch.
 */
export function fuelEconomy(fuelUps: readonly FuelUp[]): FuelEconomy | null {
  const sorted = [...fuelUps].sort((a, b) => a.odometerKm - b.odometerKm || a.at.getTime() - b.at.getTime())
  let lastFull: FuelUp | null = null
  let pendingLitres = 0
  let pendingCost = 0
  let distanceKm = 0
  let litres = 0
  let cost = 0
  for (const fill of sorted) {
    if (lastFull) {
      pendingLitres += fill.litres
      pendingCost += fill.cost
    }
    if (!fill.fullTank) continue
    if (lastFull && fill.odometerKm > lastFull.odometerKm) {
      distanceKm += fill.odometerKm - lastFull.odometerKm
      litres += pendingLitres
      cost += pendingCost
    }
    lastFull = fill
    pendingLitres = 0
    pendingCost = 0
  }
  if (distanceKm === 0) return null
  return {
    distanceKm,
    litres,
    cost,
    litresPer100Km: (litres / distanceKm) * 100,
    costPerKm: cost / distanceKm,
  }
}
