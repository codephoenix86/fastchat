const { Chat, Message } = require('@models')
const { CHAT_TYPES } = require('@constants')
const {
  createTestUser,
  createTestUsers,
  generateUsername,
  generateEmail,
  wait,
  expectError,
  expectSuccess,
  expectPagination,
} = require('@tests/helpers')

const createTestChat = (creator, participants = [], overrides = {}) => {
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

const createTestMessage = (chat, sender, overrides = {}) => {
  const messageData = {
    content: `Test message ${Date.now()}`,
    sender: sender.id,
    chat: chat._id,
    ...overrides,
  }

  return Message.create(messageData)
}

module.exports = {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  generateUsername,
  generateEmail,
  wait,
  expectError,
  expectSuccess,
  expectPagination,
}
