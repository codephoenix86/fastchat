const mongoose = require('mongoose')

const logger = require('@config/logger')
const env = require('@config/env')

// Mongoose connection events:
// https://mongoosejs.com/docs/connections.html#connection-events
mongoose.connection.on('error', (err) => {
  logger.error('Database connection error:', {
    error: err.message,
    stack: err.stack,
    name: err.name,
  })
})
mongoose.connection.on('disconnected', () => {
  logger.warn('Database disconnected')
})
mongoose.connection.on('reconnected', () => {
  logger.info('Database reconnected')
})

const connectDB = async (dbUri = env.MONGO_URI, retries = 5) => {
  try {
    await mongoose.connect(dbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    logger.info('Database connected successfully')
  } catch (err) {
    logger.error('Database connection failed:', {
      error: err.message,
      stack: err.stack,
      name: err.name,
      retries: retries,
    })

    if (retries > 0) {
      logger.info(`Retrying connection... (${retries} attempts left)`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return connectDB(retries - 1)
    }

    logger.error('Failed to connect to database after multiple attempts')
  }
}

const disconnectDB = async () => {
  try {
    await mongoose.connection.close()
    logger.info('Database connection closed')
  } catch (err) {
    logger.error('Error closing database connection:', {
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
  }
}

module.exports = { connectDB, disconnectDB }
