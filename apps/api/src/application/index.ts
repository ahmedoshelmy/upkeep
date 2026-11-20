import {
  AddRenewalHandler,
  AddTaskHandler,
  CompleteTaskHandler,
  RecordReadingHandler,
  RegisterAssetHandler,
  RenewHandler,
} from './asset-handlers'
import { DueCalculator } from './due-calculator'
import {
  DueSoonHandler,
  GetAssetHandler,
  ListAssetsHandler,
  ListNotificationsHandler,
  UsageHandler,
} from './queries'
import {
  FireReminderHandler,
  MarkNotificationReadHandler,
  PlanRenewalRemindersHandler,
  PlanTaskRemindersHandler,
  ReplanAssetHandler,
  SnoozeReminderHandler,
  SweepRemindersHandler,
} from './reminder-handlers'
import { ReminderSaga } from './reminder.saga'

/** Everything the API process registers with @nestjs/cqrs. */
export const API_HANDLERS = [
  DueCalculator,
  RegisterAssetHandler,
  AddTaskHandler,
  CompleteTaskHandler,
  RecordReadingHandler,
  AddRenewalHandler,
  RenewHandler,
  PlanTaskRemindersHandler,
  PlanRenewalRemindersHandler,
  ReplanAssetHandler,
  SnoozeReminderHandler,
  MarkNotificationReadHandler,
  ListAssetsHandler,
  GetAssetHandler,
  DueSoonHandler,
  ListNotificationsHandler,
  UsageHandler,
  ReminderSaga,
]

/** The worker only fires reminders and runs the sweep. */
export const WORKER_HANDLERS = [FireReminderHandler, SweepRemindersHandler]
