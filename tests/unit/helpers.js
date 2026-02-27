const crypto = require('crypto')
/**
 * Mock user data factory
 */
exports.createMockUser = (overrides = {}) => ({
  id: crypto.randomUUID(),
  username: 'testuser',
  email: 'test@example.com',
  password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz',
  role: 'user',
  avatar: null,
  bio: 'Test bio',
  lastSeen: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Mock chat data factory
 */
exports.createMockChat = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  type: 'private',
  participants: [crypto.randomUUID(), crypto.randomUUID()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Mock message data factory
 */
exports.createMockMessage = (overrides = {}) => ({
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

/**
 * Mock refresh token data factory
 */
exports.createMockRefreshToken = (overrides = {}) => ({
  _id: crypto.randomUUID(),
  user: crypto.randomUUID(),
  refreshToken: 'mock_refresh_token',
  createdAt: new Date(),
  ...overrides,
})

/**
 * Mock Express request
 */
exports.mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  id: 'test-request-id',
  ...overrides,
})

/**
 * Mock Express response
 */
exports.mockResponse = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.send = jest.fn().mockReturnValue(res)
  return res
}

/**
 * Mock Express next function
 */
exports.mockNext = () => jest.fn()
