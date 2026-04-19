const express = require('express')
const { mongoose } = require('@config/mongodb')
const { StatusCodes } = require('http-status-codes')
const { logger, env } = require('@config')
const { getPool } = require('@config/postgresql')
const { getClient } = require('@config/redis')
const { version } = require('@root/package.json')

const router = express.Router()

const withTimeout = (promise, ms = 2000) => {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}

router.get('/', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    environment: env.NODE_ENV,
    version: version,
    checks: {
      mongodb: 'disconnected',
      postgresql: 'disconnected',
      redis: 'disconnected',
    },
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await withTimeout(mongoose.connection.db.admin().ping())
      health.checks.mongodb = 'connected'
    } else {
      health.status = 'DEGRADED'
    }
  } catch (err) {
    health.checks.mongodb = 'error'
    health.status = 'DEGRADED'
    logger.error('Health check: MongoDB ping failed', { err })
  }

  try {
    const pool = getPool()
    await withTimeout(pool.query('SELECT 1'))
    health.checks.postgresql = 'connected'
  } catch (err) {
    health.checks.postgresql = 'error'
    health.status = 'DEGRADED'
    logger.error('Health check: PostgreSQL query failed', { err })
  }

  try {
    const client = getClient()
    await withTimeout(client.ping())
    health.checks.redis = 'connected'
  } catch (err) {
    health.checks.redis = 'error'
    health.status = 'DEGRADED'
    logger.error('Health check: Redis ping failed', { err })
  }

  const statusCode = health.status === 'OK' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE

  res.status(statusCode).json(health)
})

module.exports = router
