const { body, validationResult } = require('express-validator')
const { ValidationError } = require('../utils/errors')

exports.signup = async (req, res, next) => {
  const rules = [
    body('username').exists().withMessage('username is required'),
    body('password').exists().withMessage('password is required'),
  ]
  await Promise.all(rules.map(rule => rule.run(req)))
  const errors = validationResult(req)
  if (!errors.isEmpty())
    throw new ValidationError(
      errors.array().map(err => ({ message: err.msg, field: err.path }))
    )
  next()
}

exports.login = async (req, res, next) => {
  const rules = [
    body('username').exists().withMessage('username is required'),
    body('password').exists().withMessage('password is required'),
  ]
  await Promise.all(rules.map(rule => rule.run(req)))
  const errors = validationResult(req)
  if (!errors.isEmpty())
    throw new ValidationError(
      errors.array().map(err => ({ message: err.msg, field: err.path }))
    )
  next()
}
