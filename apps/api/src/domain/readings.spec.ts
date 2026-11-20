import { DomainError } from './errors'
import { assertMonotonic, consumptionPerPeriod, dateWhenReaching, projectUsage } from './readings'

const at = (iso: string): Date => new Date(`${iso}T00:00:00Z`)
const readings = [
  { at: at('2026-01-01'), value: 10_000 },
  { at: at('2026-01-11'), value: 10_500 },
  { at: at('2026-01-31'), value: 11_500 },
]

describe('meter readings', () => {
  it('accepts a reading above the last one and a back-filled one in between', () => {
    expect(() => assertMonotonic(readings, { at: at('2026-02-01'), value: 11_600 })).not.toThrow()
    expect(() => assertMonotonic(readings, { at: at('2026-01-20'), value: 11_000 })).not.toThrow()
  })

  it('rejects a reading that goes backwards against an earlier or a later one', () => {
    expect(() => assertMonotonic(readings, { at: at('2026-02-01'), value: 11_499 })).toThrow(DomainError)
    expect(() => assertMonotonic(readings, { at: at('2026-01-20'), value: 11_501 })).toThrow(DomainError)
    expect(() => assertMonotonic(readings, { at: at('2026-01-11'), value: 10_600 })).toThrow(DomainError)
    expect(() => assertMonotonic(readings, { at: at('2026-02-01'), value: -1 })).toThrow(DomainError)
  })

  it('computes consumption per period between consecutive readings, in any input order', () => {
    const periods = consumptionPerPeriod([...readings].reverse())
    expect(periods.map((p) => [p.units, p.perDay])).toEqual([
      [500, 50],
      [1000, 50],
    ])
  })

  it('projects usage per day over the window and predicts when a value is reached', () => {
    const usage = projectUsage(readings)
    expect(usage).toEqual({ lastValue: 11_500, lastAt: at('2026-01-31'), perDay: 50 })
    expect(dateWhenReaching(usage!, 12_000)).toEqual(at('2026-02-10'))
    expect(dateWhenReaching(usage!, 11_000)).toEqual(at('2026-01-31'))
  })

  it('only looks at the window when projecting', () => {
    const old = [{ at: at('2025-01-01'), value: 0 }, ...readings]
    expect(projectUsage(old, 90)?.perDay).toBe(50)
  })

  it('does not project from too little data or flat usage', () => {
    expect(projectUsage(readings.slice(0, 1))).toBeNull()
    expect(projectUsage([readings[0], { at: new Date(readings[0].at.getTime() + 3_600_000), value: 10_001 }])).toBeNull()
    expect(dateWhenReaching({ lastValue: 5, lastAt: at('2026-01-01'), perDay: 0 }, 10)).toBeNull()
  })
})
