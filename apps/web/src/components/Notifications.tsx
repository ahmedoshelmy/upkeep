import { useEffect, useMemo } from 'react'
import { useMutation, useQuery } from 'urql'
import { graphql } from '../gql'
import { ALL_TYPES } from './cache'

const NotificationsQuery = graphql(`
  query Notifications {
    notifications(limit: 15) {
      id
      reminderId
      title
      message
      createdAt
      readAt
    }
  }
`)

const MarkRead = graphql(`
  mutation MarkRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`)

const Snooze = graphql(`
  mutation Snooze($id: ID!, $hours: Float!) {
    snoozeReminder(id: $id, hours: $hours) {
      id
      fireAt
    }
  }
`)

/** `liveCount` bumps whenever the subscription delivers one, so the list refetches. */
export function Notifications({ liveCount }: { liveCount: number }) {
  const context = useMemo(() => ALL_TYPES, [])
  const [{ data }, refetch] = useQuery({ query: NotificationsQuery, context })
  const [, markRead] = useMutation(MarkRead)
  const [, snooze] = useMutation(Snooze)

  useEffect(() => {
    if (liveCount > 0) refetch({ requestPolicy: 'network-only' })
  }, [liveCount, refetch])

  const items = data?.notifications ?? []
  return (
    <section className="panel" aria-labelledby="inbox-title">
      <h2 id="inbox-title">Reminders inbox</h2>
      {items.length === 0 && <p className="muted">Fired reminders land here (and live, as toasts).</p>}
      <ul className="inbox">
        {items.map((n) => (
          <li key={n.id} className={n.readAt ? 'read' : 'unread'}>
            <div>
              <strong>{n.message}</strong>
              <div className="meta">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="ghost"
                onClick={() => void snooze({ id: n.reminderId, hours: 24 }, context)}
              >
                Snooze 1 day
              </button>
              {!n.readAt && (
                <button type="button" className="ghost" onClick={() => void markRead({ id: n.id }, context)}>
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
