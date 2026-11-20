import { ensure } from './errors'

/** A progressive slice: kWh inside (previous upTo, upTo] cost `pricePerKwh`. The last slice has upTo = null. */
export interface TariffSlice {
  readonly upToKwh: number | null
  readonly pricePerKwh: number
}

/**
 * Egyptian residential electricity is billed in bands: the month's total picks a band, and only that band's
 * slices apply. Using more therefore loses the cheapest slices, not only the marginal kWh.
 */
export interface TariffBand {
  readonly maxMonthlyKwh: number | null
  readonly slices: readonly TariffSlice[]
  readonly monthlyFee: number
}

export interface TariffTable {
  readonly currency: string
  readonly bands: readonly TariffBand[]
}

export interface BillLine {
  readonly kwh: number
  readonly pricePerKwh: number
  readonly amount: number
}

export interface BillEstimate {
  readonly kwh: number
  readonly bandIndex: number
  readonly lines: readonly BillLine[]
  readonly fee: number
  readonly total: number
  readonly currency: string
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function estimateBill(table: TariffTable, monthlyKwh: number): BillEstimate {
  ensure(Number.isFinite(monthlyKwh) && monthlyKwh >= 0, 'Consumption must be a non-negative number')
  ensure(table.bands.length > 0, 'The tariff table has no bands')
  const bandIndex = table.bands.findIndex((b) => b.maxMonthlyKwh === null || monthlyKwh <= b.maxMonthlyKwh)
  ensure(bandIndex >= 0, 'No tariff band covers this consumption; the last band needs maxMonthlyKwh null')
  const band = table.bands[bandIndex]
  const lines: BillLine[] = []
  let billed = 0
  for (const slice of band.slices) {
    if (billed >= monthlyKwh) break
    const top = slice.upToKwh === null ? monthlyKwh : Math.min(slice.upToKwh, monthlyKwh)
    const kwh = top - billed
    if (kwh > 0) lines.push({ kwh, pricePerKwh: slice.pricePerKwh, amount: round2(kwh * slice.pricePerKwh) })
    billed = top
  }
  ensure(billed >= monthlyKwh, 'The band slices do not cover the consumption; the last slice needs upToKwh null')
  const energy = lines.reduce((sum, l) => sum + l.amount, 0)
  return {
    kwh: monthlyKwh,
    bandIndex,
    lines,
    fee: band.monthlyFee,
    total: round2(energy + band.monthlyFee),
    currency: table.currency,
  }
}
