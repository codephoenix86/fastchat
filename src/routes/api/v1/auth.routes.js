const express = require('express')

const { auth, validators, validate } = require('@middlewares')
const { authControllers } = require('@controllers')
const { asyncHandler } = require('@utils')

const router = express.Router()

router.post('/signup', validators.auth.signup, validate, asyncHandler(authControllers.signup))

router.post('/login', validators.auth.login, validate, asyncHandler(authControllers.login))

router.post(
  '/logout',
  validators.auth.logout,
  validate,
  asyncHandler(auth.accessToken),
  asyncHandler(auth.refreshToken),
  asyncHandler(authControllers.logout)
)

router.post(
  '/refresh',
  validators.auth.refreshToken,
  validate,
  asyncHandler(auth.refreshToken),
  asyncHandler(authControllers.refreshToken)
)

module.exports = router
