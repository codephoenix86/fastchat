const express = require('express')
const router = express.Router()

// health check route
router.use('/health', require('./health.routes'))

// API routes
router.use('/api', require('./api'))

module.exports = router
