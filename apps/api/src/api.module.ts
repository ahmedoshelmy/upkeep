import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo'
import { type DynamicModule, Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { GraphQLModule } from '@nestjs/graphql'
import { join } from 'node:path'
import type { UpkeepConfig } from './config'
import { API_HANDLERS } from './application'
import { infrastructureProviders } from './infrastructure/providers'
import { formatError } from './presentation/graphql/errors'
import { LiveNotifications } from './presentation/graphql/live-notifications'
import { LoaderFactory } from './presentation/graphql/loaders'
import { queryLimitsRule } from './presentation/graphql/query-limits'
import {
  AssetResolver,
  DueResolver,
  NotificationResolver,
  ReadingResolver,
  RenewalResolver,
  TaskResolver,
} from './presentation/graphql/resolvers'
import { HealthController } from './presentation/health.controller'

export interface ApiModuleOptions {
  /** Write the SDL to apps/api/schema.gql (dev and the schema script); the image runs with an in-memory schema. */
  readonly emitSchema?: boolean
}

@Module({})
export class ApiModule {
  static register(config: UpkeepConfig, options: ApiModuleOptions = {}): DynamicModule {
    return {
      module: ApiModule,
      imports: [
        CqrsModule.forRoot(),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          path: '/graphql',
          autoSchemaFile: options.emitSchema ? join(__dirname, '..', 'schema.gql') : true,
          sortSchema: true,
          subscriptions: { 'graphql-ws': true },
          playground: false,
          introspection: true,
          validationRules: [queryLimitsRule(config.queryLimits)],
          formatError,
        }),
      ],
      controllers: [HealthController],
      providers: [
        ...infrastructureProviders(config),
        ...API_HANDLERS,
        LoaderFactory,
        LiveNotifications,
        AssetResolver,
        TaskResolver,
        RenewalResolver,
        DueResolver,
        ReadingResolver,
        NotificationResolver,
      ],
    }
  }
}
