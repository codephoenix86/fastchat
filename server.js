require('module-alias/register')
const http = require('http')
const app = require('@/app')
const { logger, env, redis, postgres } = require('@config')
const pool = postgres.getPool()
const client = redis.getClient()
const { init } = require('@sockets')
const mongoose = require('mongoose')
const server = http.createServer(app)
const io = init(server)

const startServer = async () => {
  try {
    await Promise.all([mongoose.connect(env.MONGODB_URI), client.ping(), pool.query('SELECT 1')])
    logger.info('All databases connected')
    server.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`)
    })
  } catch (err) {
    logger.error('Startup failed', err)
    /* eslint-disable no-process-exit */
    process.exit(1)
  }
}

startServer()

let isShuttingDown = false

const shutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress. Ignoring ${signal}.`)
    return
  }
  isShuttingDown = true
  logger.info(`${signal} received. Starting graceful shutdown...`)
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing exit...')
    /* eslint-disable no-process-exit */
    process.exit(1)
  }, 10000)
  forceExit.unref()

  try {
    logger.info('Closing WebSockets and HTTP server...')
    await new Promise((resolve) => {
      if (io) {
        io.close(resolve)
      } else {
        server.close(resolve)
      }
    })
    logger.info('WebSockets and HTTP server closed.')
    logger.info('Disconnecting databases...')
    await Promise.allSettled([mongoose.disconnect(), pool.end(), client.quit()])
    logger.info('All databases disconnected.')
    clearTimeout(forceExit)
    logger.info('Graceful shutdown complete. Exiting.')
    /* eslint-disable no-process-exit */
    process.exit(0)
  } catch (err) {
    logger.error('Error during graceful shutdown', err)
    /* eslint-disable no-process-exit */
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! App crashing...', err)
  /* eslint-disable no-process-exit */
  setTimeout(() => process.exit(1), 1000).unref()
})
process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION! App crashing...', reason)
  /* eslint-disable no-process-exit */
  setTimeout(() => process.exit(1), 1000).unref()
})
