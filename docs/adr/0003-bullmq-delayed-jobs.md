# 3. BullMQ delayed jobs instead of cron polling for reminders

Date: 2026-11-20

## Status

Accepted

## Context

Reminders fire at precise moments: 30, 7 and 1 days before a due date, and at the due moment. Due dates move when a
task is completed, a reading changes the projected km/day, a renewal is renewed or a reminder is snoozed. The
classic alternative is a cron job that polls "what is due now?" every N minutes.

## Decision

- Every planned reminder is a Postgres row **and** one BullMQ **delayed job** whose job id is the reminder id.
  Scheduling twice is a no-op; cancelling is a direct `remove`.
- Replanning a subject cancels its SCHEDULED rows and their jobs in one step and inserts the new plan
  (the saga drives it, see ADR 0004).
- A **separate worker process** consumes the queue (competing consumers: scale with
  `docker compose up --scale worker=N`; BullMQ's lock gives each job to one worker and re-delivers it if that
  worker dies).
- Jobs retry with **exponential backoff** (`REMINDER_ATTEMPTS`, `REMINDER_BACKOFF_MS`). After the last attempt the
  worker copies the job to a **dead-letter queue** (`reminders-dead`) with the failure reason.
- The handler is **idempotent**: only a SCHEDULED reminder fires, and the notification row is unique per reminder.
- A **repeatable job** (BullMQ job scheduler, one per deployment, not per worker) sweeps SCHEDULED reminders whose
  moment passed more than a minute ago and re-enqueues them: a safety net if Redis lost a job.
- Redis runs with AOF persistence and `noeviction`.

## Consequences

- Reminders fire on time (millisecond delays, not "within the next polling window") without scanning tables.
- Two sources of truth (row and job) must agree; the job id = reminder id link, the status check in the handler
  and the sweep keep them consistent.
- Mail and live fan-out run after the commit and never fail the job: a missed toast is acceptable, a duplicate
  reminder is not.
