import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { Clock, IdGenerator } from '../application/ports'

export const systemClock: Clock = {
  now: () => new Date(),
  sleep: async (ms) => {
    await delay(ms)
  },
}
export const uuidGenerator: IdGenerator = { next: () => randomUUID() }
