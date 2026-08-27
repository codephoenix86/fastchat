const Joi = require('joi')
const { paramUuid, requiredBody } = require('./common.schema')

const contentSchema = Joi.string().trim().max(5000).required().messages({
  'any.required': 'Message content is required',
  'string.base': 'Message content must be text',
  'string.empty': 'Message content cannot be empty',
  'string.max': 'Message content must not exceed 5000 characters',
})

const sendMessage = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
  body: Joi.object({
    content: contentSchema,
  })
    .required()
    .min(1)
    .messages({
      'any.required': 'Request body is missing. Please provide data to update.',
      'object.min': 'Request body cannot be empty. Please provide at least one field to update.',
    }),
})

const updateMessage = Joi.object({
  params: Joi.object({
    messageId: paramUuid('message ID'),
  }),
  body: Joi.object({
    content: contentSchema,
  })
    .required()
    .min(1)
    .messages({
      'any.required': 'Request body is missing. Please provide data to update.',
      'object.min': 'Request body cannot be empty. Please provide at least one field to update.',
    }),
})

const getMessageById = Joi.object({
  params: Joi.object({
    messageId: paramUuid('Message ID'),
  }),
})

const sendDirectMessage = Joi.object({
  body: requiredBody(
    Joi.object({
      peerId: Joi.string().uuid().required().messages({
        'any.required': 'peerId is required',
        'string.guid': 'Invalid peerId format. Must be a valid UUID.',
      }),
      content: contentSchema,
    })
  ),
})

const getMessages = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    cursor: Joi.string(),
  }),
})

module.exports = { sendMessage, updateMessage, getMessageById, sendDirectMessage, getMessages }
