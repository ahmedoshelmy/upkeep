import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { PubSub } from 'graphql-subscriptions'
import { NOTIFICATION_BUS, type NotificationBus } from '../../application/ports'

export const NOTIFICATION_ADDED = 'notificationAdded'

/** Bridges the cross-process notification bus into this instance's GraphQL subscription stream. */
@Injectable()
export class LiveNotifications implements OnModuleInit {
  private readonly pubSub = new PubSub()

  constructor(@Inject(NOTIFICATION_BUS) private readonly bus: NotificationBus) {}

  async onModuleInit(): Promise<void> {
    await this.bus.subscribe((notification) => {
      void this.pubSub.publish(NOTIFICATION_ADDED, { [NOTIFICATION_ADDED]: notification })
    })
  }

  iterator(): AsyncIterableIterator<unknown> {
    return this.pubSub.asyncIterableIterator(NOTIFICATION_ADDED)
  }
}
