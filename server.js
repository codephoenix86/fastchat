require('module-alias/register')
const http = require('http')

const app = require('@/app')
const {
  logger,
  env,
  db: { connectDB, disconnectDB },
} = require('@config')
const { socketServer } = require('@sockets')

const server = http.createServer(app)
const io = socketServer.init(server)

// Track shutdown state to prevent multiple shutdown attempts
let isShuttingDown = false

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal')
    return
  }

  isShuttingDown = true
  logger.info(`${signal} received, starting graceful shutdown`)

  // Set a force shutdown timeout (but don't keep process alive)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  }, 10000)

  try {
    // Stop accepting new HTTP connections
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    logger.info('HTTP server closed')

    // Close Socket.io connections
    await new Promise((resolve) => {
      io.close(() => {
        logger.info('Socket.io server closed')
        resolve()
      })
    })

    // Close database connection
    await disconnectDB()

    logger.info('Graceful shutdown completed')
    // eslint-disable-next-line no-process-exit
    process.exit(0)
  } catch (err) {
    logger.error('Error during shutdown:', {
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  }
}

// Start server
;(async () => {
  try {
    // Connect to database
    await connectDB()

    // Start listening
    server.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`)
      logger.info(`Environment: ${env.NODE_ENV}`)
      logger.info('Application started successfully')
    })

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', {
        error: err.message,
        stack: err.stack,
        name: err.name,
      })
      gracefulShutdown('uncaughtException')
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { reason, promise })
      gracefulShutdown('unhandledRejection')
    })
  } catch (err) {
    logger.error('Failed to start server:', {
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  }
})()
