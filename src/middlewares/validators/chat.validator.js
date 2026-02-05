const { body, oneOf } = require('express-validator')
const mongoose = require('mongoose')

const { CHAT_TYPES } = require('@constants')
const { message } = require('@utils')
const { userRepository, chatRepository } = require('@repositories')

exports.create = [
  body('type')
    .exists()
    .withMessage(message('Chat type is required', 'REQUIRED_FIELD', 'type'))
    .bail()
    .isIn(Object.values(CHAT_TYPES))
    .withMessage(
      message(
        `Chat type must be either ${Object.values(CHAT_TYPES).join(' or ')}`,
        'UNSUPPORTED_VALUE',
        `one_of:[${Object.values(CHAT_TYPES).join(',')}]`
      )
    ),

  body('groupName')
    .if((value, { req }) => req.body.type === CHAT_TYPES.GROUP)
    .exists()
    .withMessage(message('Group name is required for group chats', 'REQUIRED_FIELD', 'groupName'))
    .bail()
    .isString()
    .withMessage(message('Group name must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(message('Group name must be 1-50 characters long', 'OUT_OF_RANGE', '1-50_chars')),

  body('participants')
    .if((value, { req }) => req.body.type === CHAT_TYPES.PRIVATE)
    .exists()
    .withMessage(message('Participant list is required', 'REQUIRED_FIELD', 'participants'))
    .bail()
    .isArray()
    .withMessage(message('Participants must be provided as an array', 'TYPE_MISMATCH', 'array'))
    .bail()
    .custom((ids) => ids.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage(
      message('One or more participant ID formats are invalid', 'INVALID_FORMAT', 'mongodb_ids')
    )
    .bail()
    .custom((ids) => new Set(ids).size === ids.length)
    .withMessage(
      message('Each participant must be unique', 'DUPLICATE_VALUE', 'unique_mongodb_ids')
    )
    .bail()
    .custom((ids, { req }) => {
      const total = new Set([...ids.map(String), String(req.user.id)]).size
      return total === 2
    })
    .withMessage(
      message(
        'Private chat must have exactly 2 unique participants',
        'INVALID_COUNT',
        '2_total_participants'
      )
    )
    .bail()
    .custom(async (ids, { req }) => {
      const uniqueMembers = [...new Set([...ids, req.user.id])]

      const count = await userRepository.countDocuments({
        _id: { $in: uniqueMembers },
      })
      if (count !== uniqueMembers.length) {
        throw new Error('Duplicate participants')
      }
    })
    .withMessage(
      message(
        'One or more selected participants does not exist',
        'USER_NOT_FOUND',
        'registered_active_users'
      )
    ),
  body('participants')
    .if((value, { req }) => req.body.type === CHAT_TYPES.GROUP)
    .exists()
    .withMessage(message('Participant list is required', 'REQUIRED_FIELD', 'participants'))
    .bail()
    .isArray()
    .withMessage(message('Participants must be provided as an array', 'TYPE_MISMATCH', 'array'))
    .bail()
    .custom((ids) => ids.every((id) => mongoose.Types.ObjectId.isValid(id)))
    .withMessage(
      message('One or more participant ID formats are invalid', 'INVALID_FORMAT', 'mongodb_ids')
    )
    .bail()
    .custom((ids) => new Set(ids).size === ids.length)
    .withMessage(
      message('Each participant must be unique', 'DUPLICATE_VALUE', 'unique_mongodb_ids')
    )
    .bail()
    .custom((ids, { req }) => {
      const total = new Set([...ids.map(String), String(req.user.id)]).size
      return total >= 2
    })
    .withMessage(
      message(
        'Group chat must have at least 2 unique participants',
        'INVALID_COUNT',
        'min_2_unique_ids'
      )
    )
    .bail()
    .custom(async (ids, { req }) => {
      const uniqueMembers = [...new Set([...ids, req.user.id])]

      const count = await userRepository.countDocuments({
        _id: { $in: uniqueMembers },
      })
      if (count !== uniqueMembers.length) {
        throw new Error('Duplicate participants')
      }
    })
    .withMessage(
      message(
        'One or more selected participants does not exist',
        'USER_NOT_FOUND',
        'registered_active_users'
      )
    ),
]

exports.update = [
  body()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)
      if (chat.type === CHAT_TYPES.PRIVATE) {
        throw new Error('Attempt to update private chat')
      }
    })
    .withMessage(message('Cannot update private chat', 'INVALID_CHAT_TYPE', 'group_chat')),
  oneOf([body('groupName').exists(), body('groupPicture').exists(), body('admin').exists()], {
    message: message(
      'At least one field is required to update',
      'MISSING_PAYLOAD',
      'groupName_or_groupPicture_or_admin'
    ),
  }),
  body('groupName')
    .optional()
    .trim()
    .isString()
    .withMessage(message('Group name must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .isLength({ min: 1, max: 50 })
    .withMessage(
      message('Group name must be 1-50 characters long', 'OUT_OF_RANGE', '1-50 characters')
    ),

  body('groupPicture')
    .optional()
    .isString()
    .withMessage(message('Group picture must be a valid string', 'TYPE_MISMATCH', 'string')),

  body('admin')
    .optional()
    .trim()
    .isString()
    .withMessage(message('Admin must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .isMongoId()
    .withMessage(message('The provided Admin ID format is invalid', 'INVALID_FORMAT', 'mongodb_id'))
    .bail()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)

      if (!chat.participants.includes(value)) {
        throw new Error('New admin is not a member of group')
      }
    })
    .withMessage(
      message('New admin must be a member of the group', 'INVALID_ADMIN_ASSIGNMENT', 'chat_member')
    ),
]

exports.addMember = [
  body()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)
      if (chat.type === CHAT_TYPES.PRIVATE) {
        throw new Error('Attempt to add member to private chat')
      }
    })
    .withMessage(message('Cannot add members to private chat', 'INVALID_CHAT_TYPE', 'group_chat')),
  body('userId')
    .optional()
    .trim()
    .isString()
    .withMessage(message('User ID must be a valid string', 'TYPE_MISMATCH', 'string'))
    .bail()
    .isMongoId()
    .withMessage(message('The provided User ID format is invalid', 'INVALID_FORMAT', 'mongodb_id')),
]

exports.removeMember = [
  body()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)
      if (chat.type === CHAT_TYPES.PRIVATE) {
        throw new Error('Attempt to remove member from private chat')
      }
    })
    .withMessage(
      message('Cannot remove members from private chat', 'INVALID_CHAT_TYPE', 'group_chat')
    )
    .bail()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)
      if (req.params.userId !== 'me' && !chat.participants.includes(req.params.userId)) {
        throw new Error('User to deleted is not a member of group')
      }
    })
    .withMessage(message('User is not a member of this group', 'MEMBER_NOT_FOUND', 'chat_member')),
]
exports.delete = [
  body()
    .custom(async (value, { req }) => {
      const chat = await chatRepository.findById(req.params.chatId)
      if (chat.type === CHAT_TYPES.PRIVATE) {
        throw new Error('Attempt to delete private chat')
      }
    })
    .withMessage(message('Cannot delete private chat', 'INVALID_CHAT_TYPE', 'group_chat')),
]
