# 2. GraphQL (code-first, with subscriptions) instead of REST

Date: 2026-11-20

## Status

Accepted

## Context

The sibling apps expose REST (ASP.NET Core minimal APIs, Nest controllers, Spring MVC) and push live updates over
SignalR or socket.io. Upkeep's main screen is a graph: assets, their tasks with a computed due date (which needs the
asset's readings), renewals, reminders per task, a usage report per home. Different screens need different slices,
and the main live event ("a reminder fired") needs a push channel.

## Decision

- **Code-first GraphQL** with `@nestjs/graphql` + Apollo Server 5. TypeScript classes are the schema; the SDL is
  printed to `apps/api/schema.gql` (`npm run schema -w @upkeep/api`) and the web app generates typed documents from it
  with GraphQL Code Generator (client preset) and queries it with urql.
- **Subscriptions over `graphql-ws`** on the same `/graphql` path (nginx upgrades the connection). The worker
  publishes fired notifications on a Redis channel; each API instance relays them into its in-process PubSub, so any
  number of API replicas can serve subscribers.
- **DataLoader per request** for every relation (`Asset.tasks`, `Asset.renewals`, `Asset.readings`,
  `Task.reminders`, `DueItem.asset`): one SQL query per relation per request instead of one per parent.
- Domain and not-found errors map to `BAD_USER_INPUT` / `NOT_FOUND` error codes; anything else is masked.

## Consequences

- The client asks for exactly the shape it renders, and `Task.due` is a computed field resolved from batched
  readings, not a stored column that can go stale.
- Caching is harder than with REST (no URL-level HTTP cache); acceptable for a single-user dashboard. urql's
  document cache invalidates by typename after mutations.
- No query-cost limiting yet: for a public deployment add depth/complexity limits and persisted queries.
- REST is still the better fit for the sibling apps' webhook/ingestion style endpoints; this is a choice per app,
  not a house style.
