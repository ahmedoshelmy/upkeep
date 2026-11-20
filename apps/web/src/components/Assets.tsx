import { useMemo } from 'react'
import { useQuery } from 'urql'
import { graphql } from '../gql'
import { REASON_LABEL, describeDue, formatNumber } from '../lib/due'
import { ALL_TYPES } from './cache'

export const AssetsQuery = graphql(`
  query Assets {
    assets {
      id
      kind
      name
      tasks {
        id
        title
        everyKm
        everyMonths
        due {
          dueAt
          dueKm
          reason
        }
      }
      renewals {
        id
        kind
        title
        expiresAt
      }
      readings {
        id
        at
        value
      }
      fuelEconomy {
        litresPer100Km
        costPerKm
        distanceKm
      }
      usage {
        perDay
        monthlyBill {
          kwh
          total
          currency
          bandIndex
        }
      }
    }
  }
`)

const UNIT: Record<string, string> = { CAR: 'km', HOME: 'kWh', APPLIANCE: '' }

function ruleText(everyKm: number | null | undefined, everyMonths: number | null | undefined): string {
  const parts = [everyKm ? `${formatNumber(everyKm)} km` : null, everyMonths ? `${everyMonths} months` : null]
  return `every ${parts.filter(Boolean).join(' or ')}${parts.every(Boolean) ? ', whichever first' : ''}`
}

export function Assets({ now }: { now: Date }) {
  const context = useMemo(() => ALL_TYPES, [])
  const [{ data, error }] = useQuery({ query: AssetsQuery, context })
  if (error) return <p className="error">Could not load assets: {error.message}</p>
  return (
    <section aria-labelledby="assets-title">
      <h2 id="assets-title">Assets</h2>
      <div className="cards">
        {(data?.assets ?? []).map((asset) => {
          const unit = UNIT[asset.kind]
          const last = asset.readings[asset.readings.length - 1]
          return (
            <article key={asset.id} className="panel card">
              <header>
                <span className={`kind ${asset.kind.toLowerCase()}`}>{asset.kind.toLowerCase()}</span>
                <h3>{asset.name}</h3>
              </header>
              {last && (
                <p className="reading">
                  {formatNumber(last.value)} {unit}
                  {asset.usage.perDay !== null && asset.usage.perDay !== undefined && (
                    <span className="muted">
                      {' '}
                      · {formatNumber(asset.usage.perDay, 1)} {unit}/day
                    </span>
                  )}
                </p>
              )}
              {asset.fuelEconomy && (
                <p className="fuel">
                  {formatNumber(asset.fuelEconomy.litresPer100Km, 1)} L/100 km ·{' '}
                  {formatNumber(asset.fuelEconomy.costPerKm, 2)} per km
                  <span className="muted"> (over {formatNumber(asset.fuelEconomy.distanceKm)} km)</span>
                </p>
              )}
              {asset.usage.monthlyBill && (
                <p className="bill">
                  ≈ {formatNumber(asset.usage.monthlyBill.total, 2)} {asset.usage.monthlyBill.currency} /
                  month
                  <span className="muted">
                    {' '}
                    ({formatNumber(asset.usage.monthlyBill.kwh)} kWh, band{' '}
                    {asset.usage.monthlyBill.bandIndex + 1})
                  </span>
                </p>
              )}
              <ul className="rows">
                {asset.tasks.map((t) => (
                  <li key={t.id}>
                    <span>{t.title}</span>
                    <span className="muted small">{ruleText(t.everyKm, t.everyMonths)}</span>
                    {t.due && (
                      <span className="small">
                        {describeDue(t.due.dueAt, now)} · {REASON_LABEL[t.due.reason]}
                      </span>
                    )}
                  </li>
                ))}
                {asset.renewals.map((r) => (
                  <li key={r.id}>
                    <span>{r.title}</span>
                    <span className="muted small">{r.kind.toLowerCase()}</span>
                    <span className="small">expires {describeDue(r.expiresAt, now)}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
