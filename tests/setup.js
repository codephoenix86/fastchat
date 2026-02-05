require('dotenv').config({ path: '.env.test' })

const { db } = require('@tests/helpers')
const { connectTestDB, disconnectTestDB } = db

// Increase timeout for all tests
jest.setTimeout(30000)

// Mock logger
jest.mock('@config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

// Mock Socket.io for tests
jest.mock('@sockets', () => ({
  socketServer: {
    get: jest.fn(() => ({
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    })),
    init: jest.fn(),
  },
  onlineUsersService: {
    addSocket: jest.fn(),
    removeSocket: jest.fn(),
    isUserOnline: jest.fn(),
  },
  SOCKET_EVENTS: {
    MESSAGE_NEW: 'message:new',
    MESSAGE_UPDATED: 'message:updated',
    MESSAGE_DELETED: 'message:deleted',
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
  },
}))

beforeAll(async () => {
  await connectTestDB()
})

afterAll(async () => {
  await disconnectTestDB()
})
