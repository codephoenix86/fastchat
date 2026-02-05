const { body, oneOf } = require('express-validator')

const { message } = require('@utils')
const { VALIDATION } = require('@constants')

exports.update = [
  oneOf(
    [
      body('newUsername').exists(),
      body('newEmail').exists(),
      body('newPassword').exists(),
      body('newBio').exists(),
    ],
    {
      message: message(
        'At least one field is required to update',
        'MISSING_PAYLOAD',
        'newUsername_newEmail_newPassword_newBio'
      ),
    }
  ),
  body('oldPassword')
    .if((value, { req }) => req.body.newPassword || req.body.newEmail)
    .exists()
    .withMessage(
      message(
        'Old password is required to change password or email',
        'REQUIRED_FIELD',
        'oldPassword'
      )
    )
    .bail()
    .isString()
    .withMessage(message('Old password must be a valid string', 'TYPE_MISMATCH', 'string')),
  body('newUsername')
    .optional()
    .isString()
    .withMessage(message('New username must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .trim()
    .isLength({
      min: VALIDATION.USERNAME.MIN_LENGTH,
      max: VALIDATION.USERNAME.MAX_LENGTH,
    })
    .withMessage(
      message(
        `New username must be ${VALIDATION.USERNAME.MIN_LENGTH}-${VALIDATION.USERNAME.MAX_LENGTH} characters long`,
        'OUT_OF_RANGE',
        `${VALIDATION.USERNAME.MIN_LENGTH}-${VALIDATION.USERNAME.MAX_LENGTH}_chars`
      )
    )
    .bail()
    .matches(VALIDATION.USERNAME.REGEX)
    .withMessage(
      message(
        'New username must start with a letter and can only contain letters, digits, underscores, and dots',
        'INVALID_FORMAT',
        'alphanumeric_start_with_letter'
      )
    ),

  body('newEmail')
    .optional()
    .normalizeEmail()
    .isEmail()
    .withMessage(message('Invalid email address', 'INVALID_FORMAT', 'email_pattern')),

  body('newPassword')
    .optional()
    .isLength({ min: VALIDATION.PASSWORD.MIN_LENGTH })
    .withMessage(
      message(
        `New password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
        'TOO_SHORT',
        `min:${VALIDATION.PASSWORD.MIN_LENGTH}_chars`
      )
    )
    .bail()
    .matches(VALIDATION.PASSWORD.REGEX)
    .withMessage(
      message(
        'New password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
        'WEAK_PASSWORD',
        'strong_password_pattern'
      )
    ),

  body('newBio')
    .optional()
    .isString()
    .withMessage(message('Bio must be a valid string', 'REQUIRED_FIELD', 'newBio'))
    .bail()
    .trim()
    .isLength({ max: VALIDATION.BIO.MAX_LENGTH })
    .withMessage(
      message(
        `Bio must not exceed ${VALIDATION.BIO.MAX_LENGTH} characters`,
        'TOO_LONG',
        `max:${VALIDATION.BIO.MAX_LENGTH}_chars`
      )
    ),
]

exports.changePassword = [
  body('oldPassword')
    .exists()
    .withMessage(message('Old password is required', 'REQUIRED_FIELD', 'oldPassword'))
    .bail()
    .isString()
    .withMessage(message('Old password must be a valid string', 'TYPE_MISMATCH', 'string')),

  body('newPassword')
    .exists()
    .withMessage(message('New password is required', 'REQUIRED_FIELD', 'newPassword'))
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
