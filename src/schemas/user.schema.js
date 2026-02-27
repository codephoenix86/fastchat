const Joi = require('joi')
const { VALIDATION } = require('@constants')
const { paramUuid } = require('./common.schema')

const updateCurrentUser = Joi.object({
  body: Joi.object({
    username: Joi.string()
      .trim()
      .min(VALIDATION.USERNAME.MIN_LENGTH)
      .max(VALIDATION.USERNAME.MAX_LENGTH)
      .pattern(VALIDATION.USERNAME.REGEX)
      .messages({
        'string.base': 'Username must be text.',
        'string.empty': 'Username cannot be empty.',
        'string.min': 'Username must be at least {#limit} characters long.',
        'string.max': 'Username cannot exceed {#limit} characters.',
        'string.pattern.base':
          'Username format is invalid. It can only contain letters, numbers, dots, and underscores.',
      }),
    bio: Joi.string().trim().max(VALIDATION.BIO.MAX_LENGTH).messages({
      'string.base': 'Bio must be text.',
      'string.max': 'Bio cannot exceed {#limit} characters.',
    }),
  })
    .required()
    .min(1)
    .messages({
      'any.required': 'Request body is missing. Please provide data to update.',
      'object.min': 'Request body cannot be empty. Please provide at least one field to update.',
    }),
})

const changePassword = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().required().messages({
      'string.base': 'Current password must be text.',
      'string.empty': 'Current password cannot be empty.',
      'any.required': 'Current password is required.',
    }),
    newPassword: Joi.string()
      .min(VALIDATION.PASSWORD.MIN_LENGTH)
      .pattern(VALIDATION.PASSWORD.REGEX)
      .invalid(Joi.ref('currentPassword'))
      .required()
      .messages({
        'string.base': 'New password must be text.',
        'string.empty': 'New password cannot be empty.',
        'string.min': 'New password must be at least {#limit} characters long.',
        'string.pattern.base':
          'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
        'any.invalid': 'New password cannot be the same as your current password.',
        'any.required': 'New password is required.',
      }),
  })
    .required()
    .min(1)
    .messages({
      'any.required': 'Request body is missing. Please provide data to update.',
      'object.min': 'Request body cannot be empty. Please provide at least one field to update.',
    }),
})

const getUserById = Joi.object({
  params: Joi.object({
    userId: paramUuid('User ID'),
  }),
})

module.exports = { updateCurrentUser, changePassword, getUserById }
