import { Injectable } from '@nestjs/common'
import { type ICommand, type IEvent, ofType, Saga } from '@nestjs/cqrs'
import { type Observable, map } from 'rxjs'
import { PlanRenewalRemindersCommand, PlanTaskRemindersCommand, ReplanAssetCommand } from './commands'
import { ReadingRecorded, RenewalDueChanged, TaskDueChanged } from './events'

/**
 * The process manager between "something about a due date changed" and "the reminder jobs are (re)scheduled".
 * Write handlers stay small and never talk to the queue; the saga turns their events into planning commands.
 */
@Injectable()
export class ReminderSaga {
  @Saga()
  taskDueChanged = (events$: Observable<IEvent>): Observable<ICommand> =>
    events$.pipe(
      ofType(TaskDueChanged),
      map((e) => new PlanTaskRemindersCommand(e.taskId)),
    )

  @Saga()
  readingRecorded = (events$: Observable<IEvent>): Observable<ICommand> =>
    events$.pipe(
      ofType(ReadingRecorded),
      map((e) => new ReplanAssetCommand(e.assetId)),
    )

  @Saga()
  renewalDueChanged = (events$: Observable<IEvent>): Observable<ICommand> =>
    events$.pipe(
      ofType(RenewalDueChanged),
      map((e) => new PlanRenewalRemindersCommand(e.renewalId)),
    )
}
