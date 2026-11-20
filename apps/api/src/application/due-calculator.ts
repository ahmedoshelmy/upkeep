import { Inject, Injectable } from '@nestjs/common'
import { meterOf } from '../domain/asset'
import { type DueEstimate, type MaintenanceTask, nextDue } from '../domain/maintenance-task'
import { projectUsage } from '../domain/readings'
import { READINGS, type ReadingRepository } from './ports'
import type { StoredReading } from './records'

/** Projects a task's due moment from its rule and the asset's odometer readings. */
export function dueOf(task: MaintenanceTask, readings: readonly StoredReading[]): DueEstimate | null {
  const odometer = readings.filter((r) => r.assetId === task.assetId && r.meter === meterOf('CAR'))
  return nextDue(task, projectUsage(odometer))
}

@Injectable()
export class DueCalculator {
  constructor(@Inject(READINGS) private readonly readings: ReadingRepository) {}

  async dueOf(task: MaintenanceTask): Promise<DueEstimate | null> {
    return dueOf(task, await this.readings.listByAssets([task.assetId]))
  }
}
