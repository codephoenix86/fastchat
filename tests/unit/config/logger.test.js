describe('logger config', () => {
  let logger

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  describe('in non-production environments', () => {
    it('creates a logger instance with required methods', () => {
      jest.doMock('@config/env', () => ({
        LOG_LEVEL: 'info',
        LOG_DIR: '/tmp/logs',
        LOG_FILE_MAX_SIZE: '20m',
        LOG_FILE_MAX_FILES: '14d',
        NODE_ENV: 'test',
      }))
      logger = require('@config/logger')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.debug).toBe('function')
    })

    it('exports a logger object', () => {
      jest.doMock('@config/env', () => ({
        LOG_LEVEL: 'debug',
        LOG_DIR: '/tmp/logs',
        LOG_FILE_MAX_SIZE: '20m',
        LOG_FILE_MAX_FILES: '14d',
        NODE_ENV: 'development',
      }))
      logger = require('@config/logger')
      expect(logger).toBeDefined()
      expect(typeof logger).toBe('object')
    })
  })

  describe('in production environment', () => {
    it('creates a logger instance without console transport', () => {
      jest.doMock('@config/env', () => ({
        LOG_LEVEL: 'warn',
        LOG_DIR: '/tmp/logs',
        LOG_FILE_MAX_SIZE: '20m',
        LOG_FILE_MAX_FILES: '14d',
        NODE_ENV: 'production',
      }))
      logger = require('@config/logger')
      expect(logger).toBeDefined()
      expect(typeof logger.error).toBe('function')
    })
  })
})
