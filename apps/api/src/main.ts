import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ApiModule } from './api.module'
import { loadConfig } from './config'
import { seedDemoData } from './infrastructure/persistence/demo-seed'

async function bootstrap(): Promise<void> {
  const config = loadConfig()
  const app = await NestFactory.create(
    ApiModule.register(config, { emitSchema: process.env.EMIT_SCHEMA === 'true' }),
  )
  app.enableShutdownHooks()
  app.enableCors()
  if (config.demoData) await seedDemoData(app)
  await app.listen(config.port, '0.0.0.0')
  Logger.log(`Upkeep API on :${config.port}/graphql`, 'Bootstrap')
}

void bootstrap()
