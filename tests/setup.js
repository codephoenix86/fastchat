require('dotenv').config({ path: '.env.test' })

process.env.DISABLE_RATE_LIMIT = 'true'

jest.setTimeout(30000)

jest.mock('@config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

jest.mock('@sockets', () => ({
  init: jest.fn(),
  io: {
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  },
}))

jest.mock('@services/s3.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('s3.url'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}))
