const express = require('express')
const { userControllers } = require('@controllers')
const { userSchema } = require('@schemas')
const { protect, upload, validate } = require('@middlewares')
const { asyncHandler } = require('@utils')

const router = express.Router()

// Public routes
router.get('/', asyncHandler(userControllers.getUsers))

// Protected routes - Current user
router.use('/me', asyncHandler(protect.accessToken))

router
  .route('/me')
  .get(asyncHandler(userControllers.getCurrentUser))
  .patch(validate(userSchema.updateCurrentUser), asyncHandler(userControllers.updateCurrentUser))
  .delete(asyncHandler(userControllers.deleteCurrentUser))

// Avatar as sub-resource
router
  .route('/me/avatar')
  .post(upload.single('avatar'), asyncHandler(userControllers.uploadAvatar))
  .delete(asyncHandler(userControllers.deleteAvatar))

// Password management
router.patch(
  '/me/password',
  validate(userSchema.changePassword),
  asyncHandler(userControllers.changePassword)
)

router.get('/:userId', validate(userSchema.getUserById), asyncHandler(userControllers.getUserById))

module.exports = router
