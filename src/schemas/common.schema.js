const Joi = require('joi')

const paramUuid = (field) =>
  Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': `Invalid ${field} format. Must be a valid UUID.`,
      'any.required': `${field} is required in the URL parameters.`,
    })

const requiredBody = (bodySchema) =>
  bodySchema.required().min(1).messages({
    'any.required': 'Request body is missing.',
    'object.min': 'Request body cannot be empty.',
  })

module.exports = { paramUuid, requiredBody }
