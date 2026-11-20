import type { TariffTable } from '../domain/tariff'

/**
 * Egyptian residential electricity, shaped like the published tariff: the month's total picks a band, heavier
 * bands lose the cheap slices, the top bands are flat. Prices are illustrative (EGP per kWh, 2024 order of
 * magnitude) and change by decree: override the whole table with the TARIFF_JSON environment variable.
 */
export const DEFAULT_TARIFF: TariffTable = {
  currency: 'EGP',
  bands: [
    {
      maxMonthlyKwh: 100,
      monthlyFee: 1,
      slices: [
        { upToKwh: 50, pricePerKwh: 0.68 },
        { upToKwh: null, pricePerKwh: 0.78 },
      ],
    },
    {
      maxMonthlyKwh: 650,
      monthlyFee: 6,
      slices: [
        { upToKwh: 200, pricePerKwh: 0.95 },
        { upToKwh: 350, pricePerKwh: 1.55 },
        { upToKwh: null, pricePerKwh: 1.95 },
      ],
    },
    { maxMonthlyKwh: 1000, monthlyFee: 25, slices: [{ upToKwh: null, pricePerKwh: 2.1 }] },
    { maxMonthlyKwh: null, monthlyFee: 40, slices: [{ upToKwh: null, pricePerKwh: 2.23 }] },
  ],
}
