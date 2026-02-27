const bcrypt = require('bcrypt')
const { tokenService } = require('@services')
const { Chat, Message } = require('@models')
const { postgres } = require('@config')
const pool = postgres.getPool()
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

  const userStatement =
    'INSERT INTO users(username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *'
  const { username, email, password, role = 'user' } = userData
  const hashed_password = await bcrypt.hash(password, 10)
  const userResult = await pool.query(userStatement, [username, email, hashed_password, role])

  const { bio = null, avatar = null, last_seen = new Date() } = userData
  const profileStatement =
    'INSERT INTO profiles(user_id, bio, avatar, last_seen) VALUES ($1, $2, $3, $4) RETURNING *'
  const profileResult = await pool.query(profileStatement, [
    userResult.rows[0].id,
    bio,
    avatar,
    last_seen,
  ])

  const user = {
    id: userResult.rows[0].id,
    username: userResult.rows[0].username,
    email: userResult.rows[0].email,
    password_hash: userResult.rows[0].password_hash,
    role: userResult.rows[0].role,
    bio: profileResult.rows[0].bio,
    avatar: profileResult.rows[0].avatar,
    last_seen: profileResult.rows[0].last_seen,
    created_at: userResult.rows[0].created_at,
    updated_at: profileResult.rows[0].updated_at,
  }

  const tokens = await tokenService.issueTokenPair(user)

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
    sender: sender.id,
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
