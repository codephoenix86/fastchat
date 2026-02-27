const mongoose = require('mongoose')
const logger = require('./logger')

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', {
    error: err.message,
    stack: err.stack,
    name: err.name,
  })
})
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))

module.exports = mongoose
