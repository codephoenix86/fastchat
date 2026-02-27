const express = require('express')

const { protect, validate, limitRate } = require('@middlewares')
const { authSchema } = require('@schemas')
const { authControllers } = require('@controllers')
const { asyncHandler } = require('@utils')

const router = express.Router()

router.use(limitRate(15 * 60 * 1000, 5, 'auth'))

router.post('/signup', validate(authSchema.signup), asyncHandler(authControllers.signup))
router.post('/login', validate(authSchema.login), asyncHandler(authControllers.login))

router.post(
  '/logout',
  validate(authSchema.logout),
  asyncHandler(protect.refreshToken),
  asyncHandler(authControllers.logout)
)

router.post(
  '/refresh',
  validate(authSchema.refreshToken),
  asyncHandler(protect.refreshToken),
  asyncHandler(authControllers.refreshSession)
)

module.exports = router
