require('dotenv').config()
require('module-alias/register')

const http = require('http')
const app = require('@/app')
const { logger, env, redis, postgres, mongo } = require('@config')
const { init } = require('@sockets')

const SHUTDOWN_TIMEOUT_MS = 10_000

let isShuttingDown = false

const createServer = () => {
  const server = http.createServer(app)
  const io = init(server)
  return { server, io }
}

const connectDatabases = async () => {
  const pool = postgres.getPool()
  const client = redis.getClient()
  await Promise.all([mongo.connect(), client.ping(), pool.query('SELECT 1')])
  logger.info('All databases connected')
  return { pool, client }
}

const startListening = (server) =>
  new Promise((resolve, reject) => {
    server.listen(env.PORT, resolve)
    server.once('error', reject)
  })

const closeServer = (server, io) =>
  new Promise((resolve) => {
    io.close(() => server.close(resolve))
  })

const disconnectDatabases = (pool, client) =>
  Promise.allSettled([mongo.disconnect(), pool.end(), client.quit()])

const shutdown = async (signal, { server, io, pool, client }) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress', { signal })
    return
  }
  isShuttingDown = true
  logger.info('Graceful shutdown initiated', { signal })

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS })
    process.exit(1) // eslint-disable-line no-process-exit
  }, SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  try {
    await closeServer(server, io)
    logger.info('HTTP server and WebSocket connections closed')

    await disconnectDatabases(pool, client)
    logger.info('Database connections closed')

    clearTimeout(forceExit)
    logger.info('Shutdown complete')
    process.exit(0) // eslint-disable-line no-process-exit
  } catch (err) {
    logger.error('Error during graceful shutdown', { err })
    process.exit(1) // eslint-disable-line no-process-exit
  }
}

const start = async () => {
  const { server, io } = createServer()
  const { pool, client } = await connectDatabases()

  const context = { server, io, pool, client }

  process.on('SIGTERM', () => shutdown('SIGTERM', context))
  process.on('SIGINT', () => shutdown('SIGINT', context))

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { err })
    shutdown('uncaughtException', context).catch(() => process.exit(1)) // eslint-disable-line no-process-exit
  })

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    logger.error('Unhandled promise rejection', { err })
    shutdown('unhandledRejection', context).catch(() => process.exit(1)) // eslint-disable-line no-process-exit
  })

  await startListening(server)
  logger.info('Server started', { port: env.PORT, env: env.NODE_ENV })
}

start().catch((err) => {
  logger.error('Startup failed', { err })
  process.exit(1) // eslint-disable-line no-process-exit
})
