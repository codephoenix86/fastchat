const { oneOf, body, header } = require('express-validator')
const { VALIDATION } = require('@constants')
const { message } = require('@utils')

exports.signup = [
  body('email')
    .trim()
    .normalizeEmail()
    .exists()
    .withMessage(message('Email is required', 'REQUIRED_FIELD', 'email'))
    .bail()
    .isEmail()
    .withMessage(message('Invalid email address', 'INVALID_FORMAT', 'email_pattern')),

  body('username')
    .trim()
    .exists()
    .withMessage(message('Username is required', 'REQUIRED_FIELD', 'username'))
    .bail()
    .isString()
    .withMessage(message('Username must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .isLength({
      min: VALIDATION.USERNAME.MIN_LENGTH,
      max: VALIDATION.USERNAME.MAX_LENGTH,
    })
    .withMessage(
      message(
        `Username must be ${VALIDATION.USERNAME.MIN_LENGTH}-${VALIDATION.USERNAME.MAX_LENGTH} characters long`,
        'OUT_OF_RANGE',
        `${VALIDATION.USERNAME.MIN_LENGTH}-${VALIDATION.USERNAME.MAX_LENGTH}_chars`
      )
    )
    .bail()
    .matches(VALIDATION.USERNAME.REGEX)
    .withMessage(
      message(
        'Username must start with a letter and can only contain letters, digits, underscores, and dots',
        'INVALID_FORMAT',
        'alphanumeric_start_with_letter'
      )
    ),

  body('password')
    .exists()
    .withMessage(message('Password is required', 'REQUIRED_FIELD', 'password'))
    .bail()
    .isString()
    .withMessage(message('Password must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .isLength({ min: VALIDATION.PASSWORD.MIN_LENGTH })
    .withMessage(
      message(
        `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
        'TOO_SHORT',
        `min:${VALIDATION.PASSWORD.MIN_LENGTH}_chars`
      )
    )
    .bail()
    .matches(VALIDATION.PASSWORD.REGEX)
    .withMessage(
      message(
        'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
        'WEAK_PASSWORD',
        'strong_password_pattern'
      )
    ),
]

exports.login = [
  oneOf([body('email').exists(), body('username').exists()], {
    message: message(
      'Either username or email is required',
      'MISSING_IDENTIFIER',
      'email_or_username'
    ),
  }),
  body('email')
    .optional()
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage(message('Invalid email address', 'INVALID_FORMAT', 'email_pattern')),
  body('username')
    .optional()
    .trim()
    .isString()
    .withMessage(message('Username must be a valid string', 'TYPE_MISMATCH', 'string')),
  body('password')
    .exists()
    .withMessage(message('Password is required', 'REQUIRED_FIELD', 'password'))
    .bail()
    .isString()
    .withMessage(message('Password must be a valid string', 'TYPE_MISMATCH', 'string')),
]

exports.logout = [
  header('content-type')
    .matches(/^application\/x-www-form-urlencoded(;.*)?$/)
    .withMessage(
      message(
        'Content-Type must be application/x-www-form-urlencoded',
        'INVALID_CONTENT_TYPE',
        'application/x-www-form-urlencoded'
      )
    ),
  body('refresh_token')
    .exists()
    .withMessage(message('Refresh token is required to log out', 'REQUIRED_FIELD', 'refresh_token'))
    .bail()
    .isString()
    .withMessage(message('Refresh token must be a valid string', 'TYPE_MISMATCH', 'string')),
]

exports.refreshToken = [
  header('content-type')
    .matches(/^application\/x-www-form-urlencoded(;.*)?$/)
    .withMessage(
      message(
        'Content-Type must be application/x-www-form-urlencoded',
        'INVALID_CONTENT_TYPE',
        'application/x-www-form-urlencoded'
      )
    ),
  body('refresh_token')
    .exists()
    .withMessage(message('A valid refresh token is required', 'REQUIRED_FIELD', 'refresh_token'))
    .bail()
    .isString()
    .withMessage(message('Refresh token must be a valid string', 'TYPE_MISMATCH', 'string')),
]
