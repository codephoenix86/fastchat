const crypto = require('crypto')
const { buildUser } = require('@tests/factories/user.factory')
const { buildChat } = require('@tests/factories/chat.factory')
const { buildMessage } = require('@tests/factories/message.factory')

const createMockUser = (overrides = {}) => buildUser(overrides)

const createMockChat = (overrides = {}) => buildChat(overrides)

const createMockMessage = (overrides = {}) => buildMessage(overrides)

const createMockRefreshToken = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  user: crypto.randomUUID(),
  refreshToken: 'mock_refresh_token',
  createdAt: new Date(),
  ...overrides,
})

const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  id: 'test-request-id',
  ...overrides,
})

const mockResponse = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

const mockNext = () => jest.fn()

module.exports = {
  createMockUser,
  createMockChat,
  createMockMessage,
  createMockRefreshToken,
  mockRequest,
  mockResponse,
  mockNext,
}
