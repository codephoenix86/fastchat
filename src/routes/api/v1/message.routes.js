const express = require('express')

const { messageControllers } = require('@controllers')
const { asyncHandler } = require('@utils')
const { messageSchema } = require('@schemas')
const { protect, validate, limitRate, idempotency } = require('@middlewares')

const router = express.Router({ mergeParams: true })

router.use(limitRate(15 * 60 * 1000, 100, 'message'))

// Apply auth to all routes
router.use(asyncHandler(protect.accessToken))

router
  .route('/')
  .get(validate(messageSchema.getMessages), asyncHandler(messageControllers.getMessages))
  .post(
    validate(messageSchema.sendMessage),
    idempotency(),
    asyncHandler(messageControllers.sendMessage)
  )
router
  .route('/:messageId')
  .get(validate(messageSchema.getMessageById), asyncHandler(messageControllers.getMessageById))

module.exports = router
