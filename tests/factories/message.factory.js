const crypto = require('crypto')
const { Message } = require('@models')

const buildMessage = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  content: 'Test message',
  sender: crypto.randomUUID(),
  chat: crypto.randomUUID(),
  status: 'sent',
  type: 'text',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const createMessage = (chat, sender, overrides = {}) => {
  return Message.create({
    content: `Test message ${Date.now()}`,
    sender: sender.id,
    chat: chat._id,
    ...overrides,
  })
}

module.exports = { buildMessage, createMessage }
