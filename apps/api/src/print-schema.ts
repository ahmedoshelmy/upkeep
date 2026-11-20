import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql'
import { lexicographicSortSchema, printSchema } from 'graphql'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AssetResolver,
  DueResolver,
  NotificationResolver,
  ReadingResolver,
  RenewalResolver,
  TaskResolver,
} from './presentation/graphql/resolvers'

/** Writes apps/api/schema.gql without a database: the web codegen reads it. */
async function main(): Promise<void> {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false })
  await app.init()
  const factory = app.get(GraphQLSchemaFactory)
  const schema = await factory.create([
    AssetResolver,
    TaskResolver,
    RenewalResolver,
    DueResolver,
    ReadingResolver,
    NotificationResolver,
  ])
  writeFileSync(join(__dirname, '..', 'schema.gql'), printSchema(lexicographicSortSchema(schema)) + '\n')
  await app.close()
}

void main()
