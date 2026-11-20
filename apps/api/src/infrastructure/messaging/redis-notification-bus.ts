import { Redis } from 'ioredis'
import type { NotificationBus } from '../../application/ports'
import type { Notification } from '../../application/records'

/**
 * Redis pub/sub between the worker (publisher) and every API instance (subscriber). Fire-and-forget on purpose:
 * the notification row is already committed, so a missed live push only means the client sees it on next load.
 */
export class RedisNotificationBus implements NotificationBus {
  private publisher: Redis | null = null
  private subscriber: Redis | null = null

  constructor(
    private readonly url: string,
    private readonly channel: string,
  ) {}

  async publish(notification: Notification): Promise<void> {
    this.publisher ??= new Redis(this.url, { lazyConnect: false })
    await this.publisher.publish(this.channel, JSON.stringify(notification))
  }

  async subscribe(listener: (notification: Notification) => void): Promise<void> {
    this.subscriber ??= new Redis(this.url)
    this.subscriber.on('message', (_channel: string, raw: string) => {
      const parsed = JSON.parse(raw) as Notification & { createdAt: string; readAt: string | null }
      listener({
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        readAt: parsed.readAt ? new Date(parsed.readAt) : null,
      })
    })
    await this.subscriber.subscribe(this.channel)
  }

  async close(): Promise<void> {
    await Promise.all([this.publisher?.quit(), this.subscriber?.quit()])
  }
}
