import { Client, cacheExchange, fetchExchange, subscriptionExchange } from 'urql'
import { createClient as createWsClient } from 'graphql-ws'

const httpUrl = '/graphql'
const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/graphql`

const ws = createWsClient({ url: wsUrl, retryAttempts: Infinity, shouldRetry: () => true })

/** Queries and mutations over HTTP; subscriptions over graphql-ws on the same path (nginx upgrades it). */
export const client = new Client({
  url: httpUrl,
  // POST only: Apollo's CSRF prevention rejects simple GET requests without a preflight header.
  preferGetMethod: false,
  exchanges: [
    cacheExchange,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || '' }
        return {
          subscribe(sink) {
            const unsubscribe = ws.subscribe(input, sink)
            return { unsubscribe }
          },
        }
      },
    }),
  ],
})
