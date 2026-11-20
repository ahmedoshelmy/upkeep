import type { Notification } from './records'

/** A task's next due moment may have changed (created or completed). */
export class TaskDueChanged {
  constructor(readonly taskId: string) {}
}

/** A new odometer/meter reading changes the projected km/day, so km-based due dates move. */
export class ReadingRecorded {
  constructor(readonly assetId: string) {}
}

export class RenewalDueChanged {
  constructor(readonly renewalId: string) {}
}

export class ReminderFired {
  constructor(readonly notification: Notification) {}
}
