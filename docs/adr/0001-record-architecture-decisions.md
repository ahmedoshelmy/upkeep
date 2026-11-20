# 1. Record architecture decisions, and why NestJS here

Date: 2026-11-20

## Status

Accepted

## Context

Upkeep is small (an API, a worker, a web app) but built to be read by other people, including in interviews.
Decisions that feel obvious while building are invisible months later. Its sibling apps extracted from the same
personal app use .NET (Qirsh, Job Radar, Listmate), NestJS with REST and RabbitMQ (Price Watch EG) and Spring Boot
(Trip Split). Upkeep deliberately covers a different corner: GraphQL, CQRS with sagas and Redis-backed job queues.

## Decision

- Keep lightweight ADRs (this format) in `docs/adr/`, one per decision that is costly to reverse.
- NestJS on Node 22, TypeScript strict, npm workspaces (`apps/api`, `apps/web`), one lockfile and one lint config.
- Clean Architecture folders inside `apps/api/src`: `domain/` (pure TypeScript), `application/` (CQRS handlers, saga,
  ports), `infrastructure/` (Postgres via TypeORM, BullMQ, Redis pub/sub, SMTP), `presentation/` (GraphQL resolvers,
  DataLoaders, health). The API and the worker are two entrypoints over the same code.
- Enforce the dependency rule with `eslint-plugin-boundaries` and `no-restricted-imports` in `domain/`
  (no Nest, TypeORM, pg, BullMQ, ioredis, graphql, nodemailer). `npm run lint` fails on a violation.

## Consequences

- Every domain rule is unit-tested without Nest, a database or Redis.
- Application handlers use `@nestjs/cqrs` decorators and `@Inject` tokens: the one framework touch allowed outside
  infrastructure and presentation, accepted to avoid a second DI mechanism.
