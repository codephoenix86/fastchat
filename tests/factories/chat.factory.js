const crypto = require('crypto')
const { Chat } = require('@models')
const { CHAT_TYPES } = require('@constants')

const buildChat = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  type: CHAT_TYPES.PRIVATE,
  participants: [crypto.randomUUID(), crypto.randomUUID()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createChat = (creator, participants = [], overrides = {}) => {
  const allParticipants = [...new Set([creator.id, ...participants])]

  const chatData = {
    type: CHAT_TYPES.PRIVATE,
    participants: allParticipants,
    ...overrides,
  }

  if (chatData.type === CHAT_TYPES.GROUP) {
    chatData.admin = creator.id
    if (!chatData.groupName) {
      chatData.groupName = `Test Group ${Date.now()}`
    }
  }

  return Chat.create(chatData)
}

module.exports = { buildChat, createChat }
