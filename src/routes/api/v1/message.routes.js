const express = require('express')

const { messageControllers } = require('@controllers')
const { asyncHandler } = require('@utils')
const { auth, validators, validate, param } = require('@middlewares')

const router = express.Router({ mergeParams: true })

router.param('messageId', param.validateId('message'))

// Apply auth to all routes
router.use(asyncHandler(auth.accessToken))

router
  .route('/')
  .post(validators.message.sendMessage, validate, asyncHandler(messageControllers.sendMessage))
  .get(asyncHandler(messageControllers.getMessages))

router
  .route('/:messageId')
  .get(asyncHandler(messageControllers.getMessage))
  .patch(validators.message.updateMessage, validate, asyncHandler(messageControllers.updateMessage))
  .delete(asyncHandler(messageControllers.deleteMessage))

module.exports = router
