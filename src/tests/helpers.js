const mongoose = require('mongoose')

/**
 * Create a valid MongoDB ObjectId
 */
exports.createObjectId = () => new mongoose.Types.ObjectId().toString()

/**
 * Mock user data factory
 */
exports.createMockUser = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  username: 'testuser',
  email: 'test@example.com',
  password: '$2b$10$abcdefghijklmnopqrstuvwxyz', // Hashed password
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
  _id: new mongoose.Types.ObjectId(),
  type: 'private',
  participants: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Mock message data factory
 */
exports.createMockMessage = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  content: 'Test message',
  sender: new mongoose.Types.ObjectId(),
  chat: new mongoose.Types.ObjectId(),
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
  _id: new mongoose.Types.ObjectId(),
  user: new mongoose.Types.ObjectId(),
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