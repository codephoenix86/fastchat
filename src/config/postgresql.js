const { Pool } = require('pg')
const logger = require('./logger')
const env = require('./env')

let pool = null

const getPool = () => {
  if (!pool || pool.ended) {
    pool = new Pool({
      connectionString: env.POSTGRES_URI,
      max: 20,
      idleTimeoutMillis: 30000,
    })
    pool.on('error', (err) => {
      logger.error('PostgreSQL connection error', {
        error: err.message,
        stack: err.stack,
        name: err.name,
      })
    })
  }
  return pool
}

// Export the pool so your repositories/controllers can use it to query
module.exports = { getPool }
