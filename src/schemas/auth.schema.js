const Joi = require('joi')
const { VALIDATION } = require('@constants')
const { requiredBody } = require('./common.schema')

const signup = Joi.object({
  body: requiredBody(
    Joi.object({
      email: Joi.string().trim().lowercase().email().required().messages({
        'any.required': 'Email is required',
        'string.empty': 'Email is required',
        'string.email': 'Invalid email address',
      }),
      username: Joi.string()
        .trim()
        .min(VALIDATION.USERNAME.MIN_LENGTH)
        .max(VALIDATION.USERNAME.MAX_LENGTH)
        .pattern(VALIDATION.USERNAME.REGEX)
        .required()
        .messages({
          'any.required': 'Username is required',
          'string.empty': 'Username is required',
          'string.min': `Username must be at least ${VALIDATION.USERNAME.MIN_LENGTH} characters long`,
          'string.max': `Username must be at most ${VALIDATION.USERNAME.MAX_LENGTH} characters long`,
          'string.pattern.base':
            'Username must start with a letter and can only contain letters, digits, underscores, and dots',
        }),
      password: Joi.string()
        .min(VALIDATION.PASSWORD.MIN_LENGTH)
        .pattern(VALIDATION.PASSWORD.REGEX)
        .required()
        .messages({
          'any.required': 'Password is required',
          'string.empty': 'Password is required',
          'string.min': `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
          'string.pattern.base':
            'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
        }),
    })
  ),
})

const login = Joi.object({
  body: requiredBody(
    Joi.object({
      email: Joi.string().trim().lowercase().email().messages({
        'string.email': 'Invalid email address',
      }),
      username: Joi.string().trim(),
      password: Joi.string().required().messages({
        'any.required': 'Password is required',
        'string.empty': 'Password is required',
      }),
    })
  )
    .xor('email', 'username')
    .messages({
      'object.xor': 'Please provide either an email or a username, but not both.',
      'object.missing': 'Please provide an email or a username to log in.',
    }),
})

const logout = Joi.object({
  headers: Joi.object({
    'content-type': Joi.string()
      .pattern(/^application\/x-www-form-urlencoded(;.*)?$/)
      .required()
      .messages({
        'string.pattern.base': 'Content-Type must be application/x-www-form-urlencoded',
        'any.required': 'Content-Type header is required',
      }),
  }).unknown(true),
  body: requiredBody(
    Joi.object({
      refresh_token: Joi.string().required().messages({
        'any.required': 'Refresh token is required to log out',
        'string.empty': 'Refresh token is required to log out',
      }),
    })
  ),
})

const refreshToken = Joi.object({
  headers: Joi.object({
    'content-type': Joi.string()
      .pattern(/^application\/x-www-form-urlencoded(;.*)?$/)
      .required()
      .messages({
        'string.pattern.base': 'Content-Type must be application/x-www-form-urlencoded',
        'any.required': 'Content-Type header is required',
      }),
  }).unknown(true),

  body: requiredBody(
    Joi.object({
      refresh_token: Joi.string().required().messages({
        'any.required': 'A valid refresh token is required',
        'string.empty': 'A valid refresh token is required',
      }),
    })
  ),
})

module.exports = { signup, login, logout, refreshToken }
