require('dotenv').config({ path: '.env.test' })

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
  init: jest.fn(),
  io: {
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  },
}))
