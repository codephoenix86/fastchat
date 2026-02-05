const express = require('express')
const { userControllers } = require('@controllers')
const { auth, upload, validators, validate, param } = require('@middlewares')
const { asyncHandler } = require('@utils')

const router = express.Router()

// Protected routes - Current user
router
  .route('/me')
  .get(asyncHandler(auth.accessToken), asyncHandler(userControllers.getCurrentUser))
  .patch(
    validators.user.update,
    validate,
    asyncHandler(auth.accessToken),
    asyncHandler(userControllers.updateCurrentUser)
  )
  .delete(asyncHandler(auth.accessToken), asyncHandler(userControllers.deleteCurrentUser))

// Avatar as sub-resource
router
  .route('/me/avatar')
  .post(
    asyncHandler(auth.accessToken),
    upload.single('avatar'),
    asyncHandler(userControllers.uploadAvatar)
  )
  .delete(asyncHandler(auth.accessToken), asyncHandler(userControllers.deleteAvatar))

// Password management
router.patch(
  '/me/password',
  validators.user.changePassword,
  validate,
  asyncHandler(auth.accessToken),
  asyncHandler(userControllers.changePassword)
)

// Parameterized routes
router.param('id', param.validateId('user'))

// Public routes
router.get('/', asyncHandler(userControllers.getUsers))
router.get('/:id', asyncHandler(userControllers.getUserById))

module.exports = router
