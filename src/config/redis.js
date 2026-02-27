const Redis = require('ioredis')
const logger = require('./logger')
const env = require('./env')

let client = null

const getClient = () => {
  if (!client || client.status === 'end') {
    client = new Redis(env.REDIS_URI)
    client.on('error', (err) => {
      logger.error('Redis connection error', {
        error: err.message,
        stack: err.stack,
        name: err.name,
      })
    })
    client.on('reconnecting', () => logger.info('Redis reconnecting...'))
  }
  return client
}

module.exports = { getClient }
