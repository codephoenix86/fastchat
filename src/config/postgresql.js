const { Pool } = require('pg')
const logger = require('./logger')
const env = require('./env')

let pool = null

const isLocalUri = (uri) => /localhost|127\.0\.0\.1/.test(uri)

const getPool = () => {
  if (!pool || pool.ended) {
    pool = new Pool({
      connectionString: env.POSTGRES_URI,
      max: env.POSTGRES_POOL_MAX,
      idleTimeoutMillis: env.POSTGRES_POOL_IDLE_TIMEOUT_MS,
      ssl: isLocalUri(env.POSTGRES_URI) ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })
    pool.on('error', (err) => logger.error('PostgreSQL pool error', { err }))
  }
  return pool
}

module.exports = { getPool }
