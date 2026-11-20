import type { Clock } from './ports'

export interface RetryPolicy {
  /** Total tries, including the first one. */
  readonly attempts: number
  /** Wait before the second try; it doubles before each later one. */
  readonly baseDelayMs: number
}

/**
 * Runs `work` until it succeeds or the attempts run out, waiting baseDelay, 2x, 4x... in between (through the
 * clock, so tests do not sleep). The last error is rethrown. `work` must be safe to repeat.
 */
export async function retryWithBackoff<T>(
  work: () => Promise<T>,
  policy: RetryPolicy,
  clock: Clock,
  onRetry: (attempt: number, error: unknown) => void = () => undefined,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work()
    } catch (error) {
      if (attempt >= policy.attempts) throw error
      onRetry(attempt, error)
      await clock.sleep(policy.baseDelayMs * 2 ** (attempt - 1))
    }
  }
}
