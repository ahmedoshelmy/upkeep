import { useMemo } from 'react'
import { useMutation, useQuery } from 'urql'
import { graphql } from '../gql'
import { REASON_LABEL, describeDue, formatNumber, urgencyOf } from '../lib/due'
import { ALL_TYPES } from './cache'

const DueSoonQuery = graphql(`
  query DueSoon($withinDays: Int!) {
    dueSoon(withinDays: $withinDays) {
      subjectType
      subjectId
      title
      dueAt
      dueKm
      reason
      asset {
        id
        name
        kind
      }
    }
  }
`)

const CompleteTask = graphql(`
  mutation CompleteTask($input: CompleteTaskInput!) {
    completeTask(input: $input) {
      id
      lastDoneAt
    }
  }
`)

export function DueSoon({ now }: { now: Date }) {
  const context = useMemo(() => ALL_TYPES, [])
  const [{ data, fetching, error }] = useQuery({
    query: DueSoonQuery,
    variables: { withinDays: 60 },
    context,
  })
  const [, complete] = useMutation(CompleteTask)

  if (error) return <p className="error">Could not load: {error.message}</p>
  const items = data?.dueSoon ?? []
  return (
    <section className="panel" aria-labelledby="due-title">
      <h2 id="due-title">Due in the next 60 days</h2>
      {fetching && items.length === 0 && <p className="muted">Loading…</p>}
      {!fetching && items.length === 0 && <p className="muted">Nothing due. Add a task or a renewal.</p>}
      <ul className="due-list">
        {items.map((item) => {
          const urgency = urgencyOf(item.dueAt, now)
          return (
            <li key={`${item.subjectType}-${item.subjectId}`} className={`due ${urgency}`}>
              <div>
                <strong>{item.title}</strong>
                <span className="muted"> · {item.asset?.name}</span>
                <div className="meta">
                  <span className={`pill ${urgency}`}>{describeDue(item.dueAt, now)}</span>
                  <span>{REASON_LABEL[item.reason]}</span>
                  {item.dueKm !== null && item.dueKm !== undefined && (
                    <span>at {formatNumber(item.dueKm)} km</span>
                  )}
                  <span>{new Date(item.dueAt).toLocaleDateString()}</span>
                </div>
              </div>
              {item.subjectType === 'TASK' && (
                <button
                  type="button"
                  onClick={() => void complete({ input: { taskId: item.subjectId } }, context)}
                >
                  Done
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
