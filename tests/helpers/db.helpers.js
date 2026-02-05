const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { logger } = require('@config')

let mongoServer = null

/**
 * Connect to in-memory MongoDB before all tests
 */
const connectTestDB = async () => {
  try {
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }

    // Create new in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
    })

    logger.info('Test database connected (in-memory)')
    return mongoose.connection
  } catch (err) {
    logger.error('Test database connection failed:', err)
    throw err
  }
}

/**
 * Clear all collections in test database
 */
const clearDatabase = async () => {
  try {
    const collections = mongoose.connection.collections

    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))

    logger.info('Test database cleared')
  } catch (err) {
    logger.error('Error clearing database:', err)
    throw err
  }
}

/**
 * Disconnect from test database and stop MongoDB server
 */
const disconnectTestDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }

    if (mongoServer) {
      await mongoServer.stop()
      mongoServer = null
    }

    logger.info('Test database disconnected')
  } catch (err) {
    logger.error('Error disconnecting from test database:', err)
    throw err
  }
}

module.exports = {
  connectTestDB,
  clearDatabase,
  disconnectTestDB,
}
