import { ensure } from './errors'

export const ASSET_KINDS = ['CAR', 'HOME', 'APPLIANCE'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

/** What a reading on this asset measures: a car's odometer (km) or a home's electricity meter (kWh). */
export type MeterKind = 'ODOMETER_KM' | 'ELECTRICITY_KWH'

export interface Asset {
  readonly id: string
  readonly kind: AssetKind
  readonly name: string
  readonly createdAt: Date
}

export function createAsset(id: string, kind: AssetKind, name: string, now: Date): Asset {
  const trimmed = name.trim()
  ensure(ASSET_KINDS.includes(kind), `Unknown asset kind ${kind}`)
  ensure(trimmed.length > 0 && trimmed.length <= 80, 'Asset name must be 1 to 80 characters')
  return { id, kind, name: trimmed, createdAt: now }
}

/** Cars have an odometer, homes an electricity meter; appliances are tracked by time only. */
export function meterOf(kind: AssetKind): MeterKind | null {
  if (kind === 'CAR') return 'ODOMETER_KM'
  if (kind === 'HOME') return 'ELECTRICITY_KWH'
  return null
}
