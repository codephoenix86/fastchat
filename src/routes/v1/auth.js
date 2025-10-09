const express = require('express')
const router = express.Router()

const { validation, authentication } = require('../../middlewares')
const { authControllers } = require('../../controllers')
const asyncHandler = require('../../utils/asyncHandler')

router.post('/signup', asyncHandler(validation.signup), asyncHandler(authControllers.signup))
router.post(
  '/login',
  asyncHandler(validation.login),
  asyncHandler(authControllers.login)
)
router.post(
  '/logout',
  asyncHandler(validation.fields('refreshToken')),
  asyncHandler(authentication.refreshToken),
  asyncHandler(authControllers.logout)
)
router.post('/test', asyncHandler(authentication.accessToken(true)), (req, res) => {
  console.log(req.user)
  res.status(200).json(req.user)
})
router.post(
  '/refresh-token',
  asyncHandler(validation.fields('refreshToken')),
  asyncHandler(authentication.refreshToken),
  asyncHandler(authControllers.refreshToken)
)
module.exports = router
