import { DomainError } from './errors'
import { type TariffTable, estimateBill } from './tariff'

/** A small illustrative table: low users keep cheap slices, heavy users pay one flat rate. */
const table: TariffTable = {
  currency: 'EGP',
  bands: [
    {
      maxMonthlyKwh: 100,
      monthlyFee: 1,
      slices: [
        { upToKwh: 50, pricePerKwh: 0.5 },
        { upToKwh: null, pricePerKwh: 0.6 },
      ],
    },
    {
      maxMonthlyKwh: 650,
      monthlyFee: 5,
      slices: [
        { upToKwh: 200, pricePerKwh: 1 },
        { upToKwh: null, pricePerKwh: 2 },
      ],
    },
    { maxMonthlyKwh: null, monthlyFee: 10, slices: [{ upToKwh: null, pricePerKwh: 3 }] },
  ],
}

describe('electricity tariff estimate', () => {
  it('bills a low user on the first band progressively', () => {
    const bill = estimateBill(table, 80)
    expect(bill.bandIndex).toBe(0)
    expect(bill.lines.map((l) => [l.kwh, l.amount])).toEqual([
      [50, 25],
      [30, 18],
    ])
    expect(bill.total).toBe(44)
  })

  it('moves a heavier user to a band that loses the cheapest slices', () => {
    const bill = estimateBill(table, 101)
    expect(bill.bandIndex).toBe(1)
    expect(bill.total).toBe(106)
  })

  it('bills across slices inside a band', () => {
    expect(estimateBill(table, 300).total).toBe(200 + 200 + 5)
  })

  it('bills the whole month flat in the top band', () => {
    const bill = estimateBill(table, 1000)
    expect(bill).toMatchObject({ bandIndex: 2, total: 3010, currency: 'EGP' })
  })

  it('handles zero and band edges', () => {
    expect(estimateBill(table, 0).total).toBe(1)
    expect(estimateBill(table, 100).bandIndex).toBe(0)
    expect(estimateBill(table, 650).bandIndex).toBe(1)
  })

  it('rejects negative consumption and tables that do not cover it', () => {
    expect(() => estimateBill(table, -1)).toThrow(DomainError)
    const capped: TariffTable = { currency: 'EGP', bands: [{ maxMonthlyKwh: 10, monthlyFee: 0, slices: [] }] }
    expect(() => estimateBill(capped, 50)).toThrow(DomainError)
  })
})
