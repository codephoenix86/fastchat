const express = require('express')

const { asyncHandler } = require('@utils')
const { protect, validate } = require('@middlewares')
const { chatControllers } = require('@controllers')
const { chatSchema } = require('@schemas')
const messageRouter = require('./message.routes')

const router = express.Router()

// All chat routes require authentication
router.use(asyncHandler(protect.accessToken))

// Main chat resource - Full CRUD
router
  .route('/')
  .get(asyncHandler(chatControllers.getChats))
  // Accepts: ?page=1&limit=20&type=group&sort=-createdAt
  .post(validate(chatSchema.createChat), asyncHandler(chatControllers.createChat))

router
  .route('/:chatId')
  .get(validate(chatSchema.getChatById), asyncHandler(chatControllers.getChatById))
  .patch(validate(chatSchema.updateChat), asyncHandler(chatControllers.updateChat))
  .delete(validate(chatSchema.deleteChat), asyncHandler(chatControllers.deleteChat))

// Members as sub-resource (RESTful)
router.get(
  '/:chatId/members',
  validate(chatSchema.getMembers),
  asyncHandler(chatControllers.getMembers)
)

router.post(
  '/:chatId/members/:userId',
  validate(chatSchema.addMember),
  asyncHandler(chatControllers.addMember)
)

router.delete(
  '/:chatId/members/me',
  validate(chatSchema.removeSelf),
  asyncHandler(chatControllers.removeSelf)
)

router.delete(
  '/:chatId/members/:userId',
  validate(chatSchema.removeMember),
  asyncHandler(chatControllers.removeMember)
)

// Nested message routes
router.use('/:chatId/messages', messageRouter)

module.exports = router
