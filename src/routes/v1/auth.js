const express = require('express')
const { body } = require('express-validator')
const router = express.Router()

const { validation } = require('../../middlewares')
const { authControllers } = require('../../controllers')
const asyncHandler = require('../../utils/asyncHandler')

router.post(
  '/signup',
  asyncHandler(validation.signup),
  asyncHandler(authControllers.signup)
)
router.post(
  '/login',
  asyncHandler(validation.login),
  asyncHandler(authControllers.login)
)
module.exports = router
