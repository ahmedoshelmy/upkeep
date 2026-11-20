import { useEffect, useState } from 'react'
import { useSubscription } from 'urql'
import { Assets } from './components/Assets'
import { DueSoon } from './components/DueSoon'
import { Forms } from './components/Forms'
import { Notifications } from './components/Notifications'
import { graphql } from './gql'

const NotificationAdded = graphql(`
  subscription NotificationAdded {
    notificationAdded {
      id
      message
    }
  }
`)

interface Toast {
  id: string
  message: string
}

/** Re-render every 30 s so "in 2 min" style labels stay honest. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function App() {
  const now = useNow()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [liveCount, setLiveCount] = useState(0)

  useSubscription({ query: NotificationAdded }, (_previous: unknown, event) => {
    const toast = event.notificationAdded
    setToasts((list) => [toast, ...list].slice(0, 3))
    setLiveCount((n) => n + 1)
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== toast.id)), 8000)
    return event
  })

  return (
    <div className="app">
      <header className="top">
        <h1>Upkeep</h1>
        <p className="muted">
          Car and home maintenance, meters and renewals, with reminders that actually fire.
        </p>
      </header>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <strong>Reminder</strong> {t.message}
          </div>
        ))}
      </div>
      <main className="grid">
        <div className="col">
          <DueSoon now={now} />
          <Notifications liveCount={liveCount} />
        </div>
        <div className="col wide">
          <Assets now={now} />
          <Forms />
        </div>
      </main>
    </div>
  )
}
