const { User, Chat, Message, RefreshToken } = require('@models')
const {
  jwt: { generateTokens },
} = require('@utils')
const { CHAT_TYPES } = require('@constants')
const { StatusCodes } = require('http-status-codes')

// Counter for unique usernames/emails
let userCounter = 0

/**
 * Generate valid username (max 20 chars, starts with letter)
 * Uses timestamp + counter for uniqueness
 */
const generateUsername = () => {
  const timestamp = Date.now().toString(36)
  const counter = (userCounter++).toString(36)
  const random = Math.random().toString(36).substring(2, 5)
  return `u${timestamp}${counter}${random}`.substring(0, 20)
}

/**
 * Generate valid email
 * Uses timestamp + counter for uniqueness
 */
const generateEmail = () => {
  const timestamp = Date.now().toString(36)
  const counter = (userCounter++).toString(36)
  const random = Math.random().toString(36).substring(2, 5)
  return `test${timestamp}${counter}${random}@example.com`
}

/**
 * Create a test user in database
 */
const createTestUser = async (overrides = {}) => {
  const userData = {
    username: generateUsername(),
    email: generateEmail(),
    password: 'Password@123',
    ...overrides,
  }

  const user = await User.create(userData)

  const payload = {
    id: user._id.toString(),
    username: user.username,
    role: user.role,
  }

  const tokens = generateTokens(payload)

  await RefreshToken.create({
    user: user._id,
    refreshToken: tokens.refreshToken,
  })

  return { user, tokens }
}

/**
 * Create multiple test users
 * @param {Number} count - Number of users to create
 * @returns {Array} - Array of { user, tokens }
 */
const createTestUsers = async (count = 2) => {
  const users = []
  for (let i = 0; i < count; i++) {
    const testUser = await createTestUser()
    users.push(testUser)
  }
  return users
}

/**
 * Create a test chat
 * @param {Object} creator - Creator user object
 * @param {Array} participants - Array of user IDs
 * @param {Object} overrides - Chat data overrides
 * @returns {Object} - Chat document
 */
const createTestChat = async (creator, participants = [], overrides = {}) => {
  const allParticipants = [...new Set([creator._id.toString(), ...participants])]

  const chatData = {
    type: CHAT_TYPES.PRIVATE,
    participants: allParticipants,
    ...overrides,
  }

  if (chatData.type === CHAT_TYPES.GROUP) {
    chatData.admin = creator._id
    if (!chatData.groupName) {
      chatData.groupName = `Test Group ${Date.now()}`
    }
  }

  const chat = await Chat.create(chatData)
  return chat
}

/**
 * Create a test message
 * @param {Object} chat - Chat document
 * @param {Object} sender - Sender user object
 * @param {Object} overrides - Message data overrides
 * @returns {Object} - Message document
 */
const createTestMessage = async (chat, sender, overrides = {}) => {
  const messageData = {
    content: `Test message ${Date.now()}`,
    sender: sender._id,
    chat: chat._id,
    ...overrides,
  }

  const message = await Message.create(messageData)
  return message
}

/**
 * Common error response assertions
 * @param {Object} response - Supertest response
 * @param {Number} statusCode - Expected status code
 * @param {String} errorCode - Expected error code/name
 */
const expectError = (response, statusCode, errorCode = null) => {
  expect(response.status).toBe(statusCode)
  expect(response.body.success).toBe(false)
  expect(response.body.error).toBeDefined()
  expect(response.body.error.message).toBeDefined()
  expect(response.body.timestamp).toBeDefined()

  if (errorCode) {
    expect(response.body.error.code).toBe(errorCode)
  }
}

/**
 * Common success response assertions
 * @param {Object} response - Supertest response
 * @param {Number} status - Expected status code
 * @param {String} message - Expected message (optional)
 */
const expectSuccess = (response, status = StatusCodes.OK, message = null) => {
  expect(response.status).toBe(status)
  expect(response.body.success).toBe(true)
  expect(response.body.timestamp).toBeDefined()

  if (message) {
    expect(response.body.message).toBe(message)
  }
}

/**
 * Validate pagination structure
 * @param {Object} response - Supertest response
 */
const expectPagination = (response) => {
  expect(response.body.pagination).toBeDefined()
  expect(response.body.pagination.page).toBeDefined()
  expect(response.body.pagination.limit).toBeDefined()
  expect(response.body.pagination.total).toBeDefined()
  expect(response.body.pagination.totalPages).toBeDefined()
  expect(response.body.pagination.hasNextPage).toBeDefined()
  expect(response.body.pagination.hasPrevPage).toBeDefined()
}

/**
 * Wait for specified milliseconds
 * @param {Number} ms - Milliseconds to wait
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

module.exports = {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
  expectError,
  expectSuccess,
  expectPagination,
  generateUsername,
  generateEmail,
  wait,
}
