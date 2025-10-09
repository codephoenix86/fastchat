const { body, validationResult } = require('express-validator')
const { ValidationError } = require('../utils/errors')
const { User } = require('../models')
const mongoose = require('mongoose')

exports.fields =
  (...arr) =>
  async (req, res, next) => {
    const rules = arr.map(item =>
      body(item).exists().withMessage(`${item} is required`)
    )
    await Promise.all(rules.map(rule => rule.run(req)))
    const errors = validationResult(req)
    if (!errors.isEmpty())
      throw new ValidationError(
        'missing required fields',
        errors.array().map(err => ({ message: err.msg, field: err.path }))
      )
    next()
  }

exports.signup = async (req, res, next) => {
  const rules = [
    body('email')
      .exists()
      .withMessage('email is required')
      .bail()
      .isEmail()
      .withMessage('invalid email address'),
    body('username')
      .exists()
      .withMessage('username is required')
      .bail()
      .isString()
      .withMessage('username must be a string')
      .bail()
      .isLength({ min: 3, max: 20 })
      .withMessage('username must be 3-20 characters long')
      .bail()
      .matches(
        /^(?=[^.]*\.?[^.]*$)[a-zA-Z](?!.*[_]{2})[a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/
      )
      .withMessage(
        'invalid username format: username must starts with a character and can only contains letters, digits, underscores and dot '
      ),
    body('password')
      .exists()
      .withMessage('password is required')
      .bail()
      .isLength({ min: 8 })
      .withMessage('password must be at least 8 characters long')
      .bail()
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/
      )
      .withMessage(
        'password must contains at least one lowercase letter, uppercase letter, one digit and one special character'
      ),
    body('bio')
      .optional()
      .isString()
      .withMessage('bio must be a string')
      .isLength({ max: 200 })
      .withMessage('bio can be max 200 characters'),
    body('avatar').optional().isString().withMessage('avatar must be a string'),
  ]
  await Promise.all(rules.map(rule => rule.run(req)))
  const errors = validationResult(req)
  if (!errors.isEmpty())
    throw new ValidationError(
      'invalid request body',
      errors.array().map(err => ({ message: err.msg, field: err.path }))
    )
  next()
}

exports.login = async (req, res, next) => {
  const rules = [
    body().custom(body => {
      if (!body.username && !body.email)
        throw new ValidationError(
          'either username or password must be provided'
        )
      return true
    }),
    body('email').optional().isEmail().withMessage('invalid email'),
    body('username')
      .optional()
      .isString()
      .withMessage('username must be a string'),
    body('password')
      .exists()
      .withMessage('password is required')
      .bail()
      .isString()
      .withMessage(' password must be a string'),
  ]
  await Promise.all(rules.map(rule => rule.run(req)))
  const errors = validationResult(req)
  if (!errors.isEmpty())
    throw new ValidationError(
      'missing required fields',
      errors.array().map(err => ({ message: err.msg, field: err.path }))
    )
  next()
}
exports.chat = async (req, res, next) => {
  const rules = [
    body('participants')
      .exists()
      .withMessage('participants is required')
      .bail()
      .isArray()
      .withMessage('participants must be an array of user ids')
      .bail()
      .custom(value => {
        const ids = value.map(String)
        const uniqueIds = new Set(ids)
        if (ids.length !== uniqueIds.size)
          throw new ValidationError('there must not be duplicate userIds')
        return true
      })
      .bail()
      .custom(value => {
        for (const id of value) {
          if (!mongoose.Types.ObjectId.isValid(id))
            throw new ValidationError('there is at least one invalid id')
        }
        return true
      }),
  ]
  await Promise.all(rules.map(rule => rule.run(req)))
  const errors = validationResult(req)
  if (!errors.isEmpty())
    throw new ValidationError(
      'invalid chat format',
      errors.array().map(err => ({ message: err.msg, field: err.path }))
    )
  next()
}
exports.isValidId = entity => (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ValidationError(`invalid ${entity} id`)
  next()
}
