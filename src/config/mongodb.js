const mongoose = require('mongoose')
const logger = require('./logger')
const env = require('./env')

mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', { err }))
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))

const connect = () => mongoose.connect(env.MONGODB_URI)
const disconnect = () => mongoose.disconnect()

module.exports = { mongoose, connect, disconnect }
