const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const { redis } = require('@config')

module.exports = (windowMs, max, prefix) => {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return (_req, _res, next) => next()
  }

  const client = redis.getClient()
  return rateLimit({
    windowMs,
    max,
    store: new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    }),
  })
}
