import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { createServer } from 'node:http'
import { loadConfig } from './config'
import { WorkerModule } from './worker.module'

/** The reminder worker: a separate process (scale it out: competing consumers on one queue). */
async function bootstrap(): Promise<void> {
  const config = loadConfig()
  const app = await NestFactory.createApplicationContext(WorkerModule.register(config))
  app.enableShutdownHooks()
  const healthPort = Number(process.env.WORKER_HEALTH_PORT || 3001)
  // Minimal liveness endpoint for the container healthcheck; the worker has no other HTTP surface.
  createServer((req, res) => {
    const ok = req.url === '/health/ready' || req.url === '/health/live'
    res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' })
    res.end(ok ? '{"status":"ok"}' : '{}')
  }).listen(healthPort, '0.0.0.0')
  Logger.log(`Upkeep worker consuming reminders (health :${healthPort})`, 'Bootstrap')
}

void bootstrap()
