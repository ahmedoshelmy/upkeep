import { FakeClock } from './in-memory.spec-util'
import { retryWithBackoff } from './retry'

describe('retryWithBackoff', () => {
  const policy = { attempts: 3, baseDelayMs: 100 }

  it('returns the first success without waiting', async () => {
    const clock = new FakeClock(new Date(0))
    await expect(retryWithBackoff(async () => 'ok', policy, clock)).resolves.toBe('ok')
    expect(clock.slept).toEqual([])
  })

  it('waits with exponential backoff between failed tries', async () => {
    const clock = new FakeClock(new Date(0))
    let calls = 0
    const retried: number[] = []
    const result = await retryWithBackoff(
      async () => {
        if (++calls < 3) throw new Error('redis down')
        return calls
      },
      policy,
      clock,
      (attempt) => retried.push(attempt),
    )
    expect(result).toBe(3)
    expect(retried).toEqual([1, 2])
    expect(clock.slept).toEqual([100, 200])
    expect(clock.now().getTime()).toBe(300)
  })

  it('rethrows the last error when every try fails', async () => {
    const clock = new FakeClock(new Date(0))
    let calls = 0
    await expect(
      retryWithBackoff(
        async () => {
          throw new Error(`failure ${++calls}`)
        },
        policy,
        clock,
      ),
    ).rejects.toThrow('failure 3')
    expect(clock.slept).toEqual([100, 200])
  })
})
