import { ensure } from './errors'

export const RENEWAL_KINDS = ['LICENSE', 'INSURANCE', 'WARRANTY', 'INSPECTION', 'OTHER'] as const
export type RenewalKind = (typeof RENEWAL_KINDS)[number]

/** A paper that expires: a car licence, an insurance policy, an appliance warranty. */
export interface Renewal {
  readonly id: string
  readonly assetId: string
  readonly kind: RenewalKind
  readonly title: string
  readonly expiresAt: Date
}

export function createRenewal(props: Renewal): Renewal {
  const title = props.title.trim()
  ensure(RENEWAL_KINDS.includes(props.kind), `Unknown renewal kind ${props.kind}`)
  ensure(title.length > 0 && title.length <= 80, 'Renewal title must be 1 to 80 characters')
  ensure(!Number.isNaN(props.expiresAt.getTime()), 'Expiry date is invalid')
  return { ...props, title }
}

/** Renewing pushes the expiry forward; the new date must be after the old one. */
export function renew(renewal: Renewal, newExpiry: Date): Renewal {
  ensure(newExpiry > renewal.expiresAt, 'The new expiry must be after the current one')
  return { ...renewal, expiresAt: newExpiry }
}
