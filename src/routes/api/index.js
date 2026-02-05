const express = require('express')
const router = express.Router()

// version 1 routes
router.use('/v1', require('./v1'))

module.exports = router
