const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const { redis } = require('@config')
const client = redis.getClient()
module.exports = (windowMs, max, prefix) => {
  return rateLimit({
    windowMs,
    max,
    store: new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    }),
  })
}
