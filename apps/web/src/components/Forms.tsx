import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'urql'
import { graphql } from '../gql'
import { ALL_TYPES } from './cache'

const AssetNames = graphql(`
  query AssetNames {
    assets {
      id
      name
      kind
    }
  }
`)

const RegisterAsset = graphql(`
  mutation RegisterAsset($input: RegisterAssetInput!) {
    registerAsset(input: $input) {
      id
    }
  }
`)

const AddTask = graphql(`
  mutation AddTask($input: AddTaskInput!) {
    addTask(input: $input) {
      id
    }
  }
`)

const RecordReading = graphql(`
  mutation RecordReading($input: RecordReadingInput!) {
    recordReading(input: $input) {
      id
    }
  }
`)

const AddRenewal = graphql(`
  mutation AddRenewal($input: AddRenewalInput!) {
    addRenewal(input: $input) {
      id
    }
  }
`)

const num = (v: FormDataEntryValue | null): number | null => (v === null || v === '' ? null : Number(v))
const str = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '')
const dateOrNull = (v: FormDataEntryValue | null): string | null =>
  v === null || v === '' ? null : new Date(str(v)).toISOString()

/** Runs a mutation from a form; shows the GraphQL error (e.g. a reading that goes backwards) under the form. */
function useFormAction() {
  const [message, setMessage] = useState<string | null>(null)
  const run = async (form: HTMLFormElement, action: () => Promise<{ error?: { message: string } }>) => {
    const result = await action()
    setMessage(result.error ? result.error.message.replace('[GraphQL] ', '') : null)
    if (!result.error) form.reset()
  }
  return { message, run }
}

export function Forms() {
  const context = useMemo(() => ALL_TYPES, [])
  const [{ data }] = useQuery({ query: AssetNames, context })
  const assets = data?.assets ?? []
  const [, registerAsset] = useMutation(RegisterAsset)
  const [, addTask] = useMutation(AddTask)
  const [, recordReading] = useMutation(RecordReading)
  const [, addRenewal] = useMutation(AddRenewal)
  const asset = useFormAction()
  const task = useFormAction()
  const reading = useFormAction()
  const renewal = useFormAction()

  const submit =
    (handler: (form: HTMLFormElement, data: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      handler(e.currentTarget, new FormData(e.currentTarget))
    }

  const assetSelect = (name = 'assetId', filter?: (kind: string) => boolean) => (
    <select name={name} required aria-label="Asset">
      {assets
        .filter((a) => !filter || filter(a.kind))
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </select>
  )

  return (
    <section className="panel forms" aria-labelledby="add-title">
      <h2 id="add-title">Add</h2>
      <form
        onSubmit={submit(
          (form, d) =>
            void asset.run(form, () =>
              registerAsset(
                { input: { kind: str(d.get('kind')) as 'CAR', name: str(d.get('name')) } },
                context,
              ),
            ),
        )}
      >
        <h3>Asset</h3>
        <select name="kind" aria-label="Kind">
          <option value="CAR">Car</option>
          <option value="HOME">Home</option>
          <option value="APPLIANCE">Appliance</option>
        </select>
        <input name="name" placeholder="Name" required maxLength={80} />
        <button type="submit">Add asset</button>
        {asset.message && <p className="error">{asset.message}</p>}
      </form>

      <form
        onSubmit={submit(
          (form, d) =>
            void task.run(form, () =>
              addTask(
                {
                  input: {
                    assetId: str(d.get('assetId')),
                    title: str(d.get('title')),
                    everyKm: num(d.get('everyKm')),
                    everyMonths: num(d.get('everyMonths')),
                    lastDoneKm: num(d.get('lastDoneKm')),
                    dueAt: dateOrNull(d.get('dueAt')),
                  },
                },
                context,
              ),
            ),
        )}
      >
        <h3>Maintenance task</h3>
        {assetSelect()}
        <input name="title" placeholder="e.g. Oil change" required maxLength={80} />
        <div className="row">
          <input name="everyKm" type="number" min={1} placeholder="every km" aria-label="Every km" />
          <input
            name="everyMonths"
            type="number"
            min={1}
            max={120}
            placeholder="every months"
            aria-label="Every months"
          />
        </div>
        <input
          name="lastDoneKm"
          type="number"
          min={0}
          placeholder="odometer when last done"
          aria-label="Last done km"
        />
        <label className="small muted">
          Known due date (optional)
          <input name="dueAt" type="datetime-local" />
        </label>
        <button type="submit">Add task</button>
        {task.message && <p className="error">{task.message}</p>}
      </form>

      <form
        onSubmit={submit(
          (form, d) =>
            void reading.run(form, () =>
              recordReading(
                { input: { assetId: str(d.get('assetId')), value: Number(d.get('value')) } },
                context,
              ),
            ),
        )}
      >
        <h3>Meter reading</h3>
        {assetSelect('assetId', (k) => k !== 'APPLIANCE')}
        <input
          name="value"
          type="number"
          min={0}
          step="any"
          placeholder="km or kWh"
          required
          aria-label="Reading"
        />
        <button type="submit">Record</button>
        {reading.message && <p className="error">{reading.message}</p>}
      </form>

      <form
        onSubmit={submit(
          (form, d) =>
            void renewal.run(form, () =>
              addRenewal(
                {
                  input: {
                    assetId: str(d.get('assetId')),
                    kind: str(d.get('kind')) as 'LICENSE',
                    title: str(d.get('title')),
                    expiresAt: new Date(str(d.get('expiresAt'))).toISOString(),
                  },
                },
                context,
              ),
            ),
        )}
      >
        <h3>Renewal</h3>
        {assetSelect()}
        <select name="kind" aria-label="Renewal kind">
          <option value="LICENSE">Licence</option>
          <option value="INSURANCE">Insurance</option>
          <option value="WARRANTY">Warranty</option>
          <option value="INSPECTION">Inspection</option>
          <option value="OTHER">Other</option>
        </select>
        <input name="title" placeholder="e.g. Car licence" required maxLength={80} />
        <input name="expiresAt" type="date" required aria-label="Expires" />
        <button type="submit">Add renewal</button>
        {renewal.message && <p className="error">{renewal.message}</p>}
      </form>
    </section>
  )
}
