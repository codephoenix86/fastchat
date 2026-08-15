const Joi = require('joi')
const { CHAT_TYPES } = require('@constants')
const { paramUuid, requiredBody } = require('./common.schema')

const createChat = Joi.object({
  body: requiredBody(
    Joi.object({
      type: Joi.string()
        .valid(...Object.values(CHAT_TYPES))
        .required()
        .messages({
          'any.required': 'Chat type is required',
          'any.only': `Chat type must be either ${Object.values(CHAT_TYPES).join(' or ')}`,
        }),
      groupName: Joi.string()
        .trim()
        .min(1)
        .max(50)
        .when('type', {
          is: CHAT_TYPES.GROUP,
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        })
        .messages({
          'any.required': 'Group name is required for group chats',
          'string.min': 'Group name must be 1-50 characters long',
          'string.max': 'Group name must be 1-50 characters long',
          'any.unknown': 'Private chats cannot have a group name',
        }),
      participants: Joi.array()
        .items(
          Joi.string().uuid().message({
            'string.guid': 'One or more participant ID formats are invalid',
          })
        )
        .required()
        .unique()
        .when('type', {
          is: CHAT_TYPES.PRIVATE,
          then: Joi.array().length(1).messages({
            'array.length': 'A private chat must have exactly 2 participants.',
          }),
        })
        .when('type', {
          is: CHAT_TYPES.GROUP,
          then: Joi.array().min(1).messages({
            'array.min': 'A group chat must have at least 2 participants.',
          }),
        })
        .messages({
          'any.required': 'Participant list is required',
          'array.base': 'Participants must be provided as a list',
          'array.unique': 'Each participant must be unique',
        }),
    })
  ),
})

const getChatById = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
})

const updateChat = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
  body: requiredBody(
    Joi.object({
      groupName: Joi.string().trim().min(1).max(50).messages({
        'string.base': 'Group name must be a valid string',
        'string.min': 'Group name must be 1-50 characters long',
        'string.max': 'Group name must be 1-50 characters long',
      }),
      admin: Joi.string().uuid().messages({
        'string.guid': 'The provided Admin ID format is invalid',
      }),
    })
  ),
})

const addMember = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
    userId: paramUuid('User ID'),
  }),
})

const removeMember = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
    userId: paramUuid('User ID'),
  }),
})

const deleteGroup = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
})

const getMembers = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
})

const removeSelf = Joi.object({
  params: Joi.object({
    chatId: paramUuid('Chat ID'),
  }),
})

module.exports = {
  createChat,
  getChatById,
  updateChat,
  addMember,
  removeMember,
  deleteGroup,
  getMembers,
  removeSelf,
}
