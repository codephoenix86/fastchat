const { body } = require('express-validator')
const { message } = require('@utils')

exports.sendMessage = [
  body('content')
    .exists()
    .withMessage(message('Message content is required', 'REQUIRED_FIELD', 'content'))
    .bail()
    .isString()
    .withMessage(message('Message content must be text', 'TYPE_MISMATCH', 'string'))
    .bail()
    .trim()
    .notEmpty()
    .withMessage(message('Message content cannot be empty', 'EMPTY_VALUE', 'non-empty string'))
    .isLength({ max: 5000 })
    .withMessage(
      message('Message content must not exceed 5000 characters', 'TOO_LONG', 'max:5000_chars')
    ),
]

exports.updateMessage = [
  body('content')
    .exists()
    .withMessage(message('Message content is required', 'REQUIRED_FIELD', 'content'))
    .bail()
    .isString()
    .withMessage(message('Message content must be text', 'TYPE_MISMATCH', 'string'))
    .bail()
    .trim()
    .notEmpty()
    .withMessage(message('Message content cannot be empty', 'EMPTY_VALUE', 'non-empty string'))
    .bail()
    .isLength({ max: 5000 })
    .withMessage(
      message('Message content must not exceed 5000 characters', 'TOO_LONG', 'max:5000_chars')
    ),
]
