const express = require('express')
const mongoose = require('mongoose')
const { logger, env } = require('@config')
const { HTTP_STATUS } = require('@constants')

const router = express.Router()

router.get('/', (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    environment: env.NODE_ENV,
    version: '1.0.0',
    checks: {
      database: 'unknown',
    },
  }

  try {
    const dbState = mongoose.connection.readyState
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    if (dbState === 1) {
      health.checks.database = 'connected'
    } else {
      health.checks.database = 'disconnected'
      health.status = 'DEGRADED'
    }
  } catch (err) {
    logger.error('Health check error:', {
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
    health.checks.database = 'error'
    health.status = 'DEGRADED'
  }

  const statusCode = health.status === 'OK' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE
  res.status(statusCode).json(health)
})

module.exports = router
