# 4. CQRS with @nestjs/cqrs, and where it is overkill

Date: 2026-11-20

## Status

Accepted

## Context

Writes in Upkeep have a side effect that belongs to a different concern: whenever a due date may have moved,
reminder jobs must be replanned. Putting queue calls into every write handler couples them to BullMQ and repeats the
replanning logic.

## Decision

- Commands (`AddTask`, `CompleteTask`, `RecordReading`, `AddRenewal`, `Renew`, `SnoozeReminder`, ...) and queries
  (`DueSoon`, `ListAssets`, `Usage`, ...) go through `CommandBus` / `QueryBus`. Resolvers only translate GraphQL
  input into commands.
- Write handlers publish small **domain events**: `TaskDueChanged`, `ReadingRecorded`, `RenewalDueChanged`.
- A **saga** (`ReminderSaga`) maps those events to planning commands (`PlanTaskReminders`, `ReplanAsset`,
  `PlanRenewalReminders`). Only the planning handlers know about the reminder queue port.
- The worker process registers only `FireReminder` and `SweepReminders`.

## Consequences

- Each handler is small and unit-tested with in-memory ports; the saga is the single place to read "what happens
  after a write".
- Planning is **eventually consistent**: `addTask` returns before its reminders exist (milliseconds later). The
  integration test waits for them; the UI does not need them immediately.
- Saga failures are not retried by `@nestjs/cqrs`. The sweep job covers lost jobs, but a failed *planning* step is
  only logged. A production version would plan through a transactional outbox or a BullMQ "plan" job.
- **Where it is overkill**: the queries are plain reads with no separate read model or store, so the QueryBus adds a
  hop without a benefit beyond uniformity. `RegisterAsset` has no side effect at all. A plain service layer would do
  for those; CQRS earns its keep only on the reminder flow.
