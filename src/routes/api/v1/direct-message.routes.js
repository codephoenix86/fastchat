const express = require('express')

const { messageControllers } = require('@controllers')
const { asyncHandler } = require('@utils')
const { messageSchema } = require('@schemas')
const { protect, validate, limitRate } = require('@middlewares')

const router = express.Router()

router.use(limitRate(15 * 60 * 1000, 100, 'message'))
router.use(asyncHandler(protect.accessToken))

router.post(
  '/direct',
  validate(messageSchema.sendDirectMessage),
  asyncHandler(messageControllers.sendDirectMessage)
)

module.exports = router
