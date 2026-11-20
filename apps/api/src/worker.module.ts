import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common'
import { CommandBus, CqrsModule } from '@nestjs/cqrs'
import type { UpkeepConfig } from './config'
import { UPKEEP_CONFIG } from './config'
import { WORKER_HANDLERS } from './application'
import { QUEUE_SETTINGS, infrastructureProviders } from './infrastructure/providers'
import type { QueueSettings } from './infrastructure/queue/reminder-queue'
import { ReminderWorker } from './infrastructure/queue/reminder-worker'

/** Owns the BullMQ consumer for this process; started after every handler is registered. */
@Injectable()
export class WorkerRunner implements OnApplicationBootstrap, OnModuleDestroy {
  readonly worker: ReminderWorker

  constructor(
    @Inject(QUEUE_SETTINGS) settings: QueueSettings,
    @Inject(UPKEEP_CONFIG) config: UpkeepConfig,
    commands: CommandBus,
  ) {
    this.worker = new ReminderWorker(
      {
        ...settings,
        concurrency: config.workerConcurrency,
        sweepEveryMs: config.sweepEveryMs,
        name: config.workerName,
      },
      commands,
    )
  }

  onApplicationBootstrap(): Promise<void> {
    return this.worker.start()
  }

  onModuleDestroy(): Promise<void> {
    return this.worker.close()
  }
}

@Module({})
export class WorkerModule {
  static register(config: UpkeepConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [CqrsModule.forRoot()],
      providers: [...infrastructureProviders(config), ...WORKER_HANDLERS, WorkerRunner],
    }
  }
}
